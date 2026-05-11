import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Article,
  ArticleDocument,
  ArticleObjectStatus,
} from './schemas/article.schema';
import {
  Loan,
  LoanDocument,
  LoanReturnCondition,
  LoanStatus,
} from './schemas/loan.schema';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { AuditActor, AuditService } from './audit.service';
import { AuditEntityType } from './schemas/audit-log.schema';
import {
  ArticleCategory,
  ArticleCategoryDocument,
} from './schemas/article-category.schema';
import { defaultCategoryRules } from './article-categories.service';

export type LoanItemInput = {
  articuloId: string;
  cantidad: number;
};

export type CreateLoanInput = {
  docenteId: string;
  items: LoanItemInput[];
  fechaInicio: string | Date;
  fechaLimite: string | Date;
  horaInicio: string;
  horaFin: string;
};

export const MAX_ARTICLE_LOAN_DAYS = 0;
export const MAX_ARTICLE_LOAN_MINUTES = 4 * 60;

const DAY_MS = 24 * 60 * 60 * 1000;

function localDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localMinutes(value: Date) {
  return value.getHours() * 60 + value.getMinutes();
}

function toStartOfUTCDate(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function validateLoanDates(
  fechaInicioInput: string | Date,
  fechaLimiteInput: string | Date,
) {
  const fechaInicio = new Date(fechaInicioInput);
  const fechaLimite = new Date(fechaLimiteInput);
  if (Number.isNaN(fechaInicio.getTime()))
    throw new BadRequestException('Invalid fechaInicio');
  if (Number.isNaN(fechaLimite.getTime()))
    throw new BadRequestException('Invalid fechaLimite');

  const startDay = toStartOfUTCDate(fechaInicio);
  const dueDay = toStartOfUTCDate(fechaLimite);
  const diffDays = Math.round((dueDay.getTime() - startDay.getTime()) / DAY_MS);

  if (diffDays < 0) {
    throw new BadRequestException(
      'La fecha límite debe ser igual o posterior a la fecha de inicio',
    );
  }

  if (diffDays > MAX_ARTICLE_LOAN_DAYS) {
    throw new BadRequestException(
      'Los préstamos de artículos deben devolverse el mismo día',
    );
  }

  return { fechaInicio, fechaLimite };
}

function parseTimeToMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function validateLoanTimeRange(horaInicio: string, horaFin: string) {
  const startMin = parseTimeToMinutes(horaInicio);
  const endMin = parseTimeToMinutes(horaFin);

  if (startMin === null)
    throw new BadRequestException('Invalid horaInicio');
  if (endMin === null)
    throw new BadRequestException('Invalid horaFin');
  if (endMin <= startMin) {
    throw new BadRequestException(
      'La hora de devolución debe ser posterior a la hora de inicio',
    );
  }
  if (endMin - startMin > MAX_ARTICLE_LOAN_MINUTES) {
    throw new BadRequestException(
      'Los préstamos de artículos no pueden superar 4 horas',
    );
  }

  return { startMin, endMin };
}

export function validateLoanReturnReport(input?: {
  condition?: string;
  note?: string;
}) {
  const returnCondition =
    input?.condition === LoanReturnCondition.ISSUE
      ? LoanReturnCondition.ISSUE
      : LoanReturnCondition.OK;
  const returnNote = input?.note?.trim() || undefined;

  if (
    returnCondition === LoanReturnCondition.ISSUE &&
    (!returnNote || returnNote.length < 5)
  ) {
    throw new BadRequestException('note must be at least 5 chars');
  }

  return { returnCondition, returnNote };
}

@Injectable()
export class LoansService {
  constructor(
    @InjectModel(Loan.name)
    private readonly loanModel: Model<LoanDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(ArticleCategory.name)
    private readonly categoryModel: Model<ArticleCategoryDocument>,
    private readonly auditService: AuditService,
  ) {}

  private async refreshOverdues() {
    const now = new Date();
    const todayStr = localDateString(now);
    const startOfTodayUTC = new Date(`${todayStr}T00:00:00.000Z`);
    const currentMinutes = localMinutes(now);

    const overdueLoans = await this.loanModel
      .find({
        estado: LoanStatus.ACTIVE,
        $or: [
          { fechaLimite: { $lt: startOfTodayUTC } },
          { fechaLimite: startOfTodayUTC, endMin: { $lt: currentMinutes } },
        ],
      })
      .lean();

    if (overdueLoans.length === 0) return;

    const overdueIds = overdueLoans.map((l) => l._id);
    await this.loanModel.updateMany(
      { _id: { $in: overdueIds }, estado: LoanStatus.ACTIVE },
      { $set: { estado: LoanStatus.OVERDUE } },
    );

    const overdueTeacherIds = [
      ...new Set(overdueLoans.map((loan) => String(loan.docenteId))),
    ].map((id) => new Types.ObjectId(id));
    if (overdueTeacherIds.length > 0) {
      await this.userModel.updateMany(
        { _id: { $in: overdueTeacherIds }, rol: UserRole.TEACHER },
        { $set: { bloqueado: true } },
      );
    }

    await this.notificationModel.insertMany(
      overdueLoans.map((l) => ({
        usuarioId: l.docenteId,
        tipo: NotificationType.OVERDUE,
        titulo: 'Préstamo vencido',
        mensaje:
          'Tienes un préstamo vencido. Por favor, solicita la devolución lo antes posible.',
        leida: false,
      })),
      { ordered: false },
    );
  }

  async list() {
    await this.refreshOverdues();
    return this.loanModel.find().sort({ createdAt: -1 }).lean();
  }

  async listByStatus(status?: LoanStatus) {
    await this.refreshOverdues();
    const q = status ? { estado: status } : {};
    return this.loanModel.find(q).sort({ createdAt: -1 }).lean();
  }

  async listMine(docenteId: string, status?: LoanStatus) {
    await this.refreshOverdues();
    if (!Types.ObjectId.isValid(docenteId))
      throw new BadRequestException('Invalid docenteId');
    const q: Record<string, unknown> = {
      docenteId: new Types.ObjectId(docenteId),
    };
    if (status) q.estado = status;
    return this.loanModel.find(q).sort({ createdAt: -1 }).lean();
  }

  async createRequest(input: CreateLoanInput, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(input?.docenteId))
      throw new BadRequestException('Invalid docenteId');
    if (!Array.isArray(input.items) || input.items.length === 0)
      throw new BadRequestException('items is required');

    const teacher = await this.userModel.findById(input.docenteId).lean();
    if (!teacher) throw new NotFoundException('Docente not found');
    if (teacher.rol !== UserRole.TEACHER)
      throw new BadRequestException('Solo se permiten préstamos a docentes');

    const { fechaInicio, fechaLimite } = validateLoanDates(
      input.fechaInicio,
      input.fechaLimite,
    );
    const { startMin, endMin } = validateLoanTimeRange(
      input.horaInicio,
      input.horaFin,
    );

    const normalizedItems = input.items.map((it) => {
      if (!Types.ObjectId.isValid(it.articuloId))
        throw new BadRequestException('Invalid articuloId');
      const cantidad = Math.floor(Number(it.cantidad));
      if (!Number.isFinite(cantidad) || cantidad < 1)
        throw new BadRequestException('cantidad must be >= 1');
      return { articuloId: new Types.ObjectId(it.articuloId), cantidad };
    });

    const articleIds = normalizedItems.map((it) => it.articuloId);
    const articles = await this.articleModel
      .find({ _id: { $in: articleIds } })
      .lean();
    if (articles.length !== articleIds.length)
      throw new BadRequestException('Uno o más artículos no existen');

    const items = normalizedItems.map((it) => {
      const article = articles.find(
        (a) => String(a._id) === String(it.articuloId),
      );
      if (!article) throw new BadRequestException('Artículo no encontrado');
      const defaults = defaultCategoryRules(article.categoria);
      if (!defaults.prestable) {
        throw new BadRequestException(
          `La categoría no permite préstamos: ${article.categoria}`,
        );
      }
      return {
        articuloId: it.articuloId,
        nombreArticulo: article.nombre,
        serialArticulo: (article as unknown as { serial?: unknown }).serial
          ? String((article as unknown as { serial?: unknown }).serial)
          : undefined,
        cantidad: it.cantidad,
      };
    });

    const categories = await this.categoryModel
      .find({
        nombre: { $in: [...new Set(articles.map((article) => article.categoria))] },
      })
      .lean();
    const maxMinutes = Math.min(
      ...articles.map((article) => {
        const configured = categories.find(
          (category) => category.nombre === article.categoria,
        );
        const defaults = defaultCategoryRules(article.categoria);
        if (configured && configured.prestable === false) {
          throw new BadRequestException(
            `La categoría no permite préstamos: ${article.categoria}`,
          );
        }
        return Math.floor(
          Number(configured?.maxLoanMinutes ?? defaults.maxLoanMinutes),
        );
      }),
    );

    if (endMin - startMin > maxMinutes) {
      throw new BadRequestException(
        `El préstamo no puede superar ${maxMinutes} minutos para esta categoría`,
      );
    }

    const overlappingLoans = await this.loanModel.find({
      estado: {
        $in: [
          LoanStatus.PENDING,
          LoanStatus.APPROVED,
          LoanStatus.ACTIVE,
          LoanStatus.OVERDUE,
        ],
      },
      fechaInicio,
      startMin: { $lt: endMin },
      endMin: { $gt: startMin },
      'items.articuloId': { $in: articleIds },
    }).lean();

    for (const article of articles) {
      const requested =
        normalizedItems.find(
          (item) => String(item.articuloId) === String(article._id),
        )?.cantidad ?? 0;
      const reserved = overlappingLoans.reduce((sum, loan) => {
        const used = loan.items
          .filter((item) => String(item.articuloId) === String(article._id))
          .reduce((itemSum, item) => itemSum + item.cantidad, 0);
        return sum + used;
      }, 0);
      if (reserved + requested > article.stockTotal) {
        throw new BadRequestException(
          `El artículo no está disponible en ese horario: ${article.nombre}`,
        );
      }
    }

    const created = await this.loanModel.create({
      docenteId: new Types.ObjectId(input.docenteId),
      nombreDocente: teacher.nombreCompleto,
      programa: teacher.programa,
      items,
      fechaInicio,
      fechaLimite,
      startMin,
      endMin,
      estado: LoanStatus.PENDING,
    });

    await this.notificationModel.create({
      usuarioId: new Types.ObjectId(input.docenteId),
      tipo: NotificationType.REQUEST,
      titulo: 'Solicitud registrada',
      mensaje:
        'Tu solicitud de préstamo fue registrada y está pendiente de revisión.',
      leida: false,
    });

    await this.auditService.record({
      accion: 'loan.requested',
      entidadTipo: AuditEntityType.LOAN,
      entidadId: created._id,
      entidadNombre: `Préstamo ${teacher.nombreCompleto}`,
      actor,
      metadata: { items, fechaInicio, fechaLimite, startMin, endMin },
    });

    return created.toObject();
  }

  async approve(id: string, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');

    const loan = await this.loanModel.findById(id);
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.estado !== LoanStatus.PENDING)
      throw new BadRequestException(
        'Solo se pueden aprobar solicitudes pendientes',
      );

    const articleIds = loan.items.map((it) => it.articuloId);
    const articles = await this.articleModel.find({ _id: { $in: articleIds } });

    for (const it of loan.items) {
      const article = articles.find(
        (a) => String(a._id) === String(it.articuloId),
      );
      if (!article) throw new BadRequestException('Artículo no encontrado');
      if (!article.activo)
        throw new BadRequestException(`Artículo inactivo: ${article.nombre}`);
      if (article.estadoObjeto !== ArticleObjectStatus.OPERATIONAL)
        throw new BadRequestException(
          `Artículo no operativo: ${article.nombre}`,
        );
      if (article.stockDisponible < it.cantidad)
        throw new BadRequestException(
          `Stock insuficiente para: ${article.nombre}`,
        );
    }

    for (const it of loan.items) {
      const article = articles.find(
        (a) => String(a._id) === String(it.articuloId),
      );
      if (!article) continue;
      article.stockDisponible -= it.cantidad;
      await article.save();
    }

    loan.estado = LoanStatus.APPROVED;
    loan.notaAdmin = undefined;
    await loan.save();

    await this.notificationModel.create({
      usuarioId: loan.docenteId,
      tipo: NotificationType.REQUEST,
      titulo: 'Solicitud aprobada',
      mensaje: 'Tu solicitud fue aprobada y está lista para ser recogida.',
      leida: false,
    });

    await this.auditService.record({
      accion: 'loan.approved',
      entidadTipo: AuditEntityType.LOAN,
      entidadId: loan._id,
      entidadNombre: loan.nombreDocente,
      actor,
      metadata: { estado: loan.estado },
    });

    return loan.toObject();
  }

  async deliver(id: string, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');

    const loan = await this.loanModel.findById(id);
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.estado !== LoanStatus.APPROVED)
      throw new BadRequestException(
        'Solo se pueden entregar préstamos reservados',
      );

    loan.estado = LoanStatus.ACTIVE;
    await loan.save();

    await this.notificationModel.create({
      usuarioId: loan.docenteId,
      tipo: NotificationType.SYSTEM,
      titulo: 'Préstamo entregado',
      mensaje: 'Tus artículos han sido entregados y el préstamo está activo.',
      leida: false,
    });

    await this.auditService.record({
      accion: 'loan.delivered',
      entidadTipo: AuditEntityType.LOAN,
      entidadId: loan._id,
      entidadNombre: loan.nombreDocente,
      actor,
      metadata: { estado: loan.estado },
    });

    return loan.toObject();
  }

  async reject(id: string, note: string, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    if (!note?.trim() || note.trim().length < 5)
      throw new BadRequestException('note must be at least 5 chars');

    const loan = await this.loanModel.findById(id);
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.estado !== LoanStatus.PENDING)
      throw new BadRequestException(
        'Solo se pueden rechazar solicitudes pendientes',
      );

    loan.estado = LoanStatus.REJECTED;
    loan.notaAdmin = note.trim();
    await loan.save();

    await this.notificationModel.create({
      usuarioId: loan.docenteId,
      tipo: NotificationType.REQUEST,
      titulo: 'Solicitud rechazada',
      mensaje: 'Tu solicitud fue rechazada. Revisa la nota del administrador.',
      leida: false,
    });

    await this.auditService.record({
      accion: 'loan.rejected',
      entidadTipo: AuditEntityType.LOAN,
      entidadId: loan._id,
      entidadNombre: loan.nombreDocente,
      actor,
      metadata: { note: loan.notaAdmin },
    });

    return loan.toObject();
  }

  async markReturned(
    id: string,
    input?: { condition?: string; note?: string },
    actor?: AuditActor,
  ) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    const { returnCondition, returnNote } = validateLoanReturnReport(input);

    const loan = await this.loanModel.findById(id);
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.estado !== LoanStatus.ACTIVE && loan.estado !== LoanStatus.OVERDUE)
      throw new BadRequestException(
        'Solo se pueden marcar como devueltos los préstamos activos o vencidos',
      );

    const articleIds = loan.items.map((it) => it.articuloId);
    const articles = await this.articleModel.find({ _id: { $in: articleIds } });

    for (const it of loan.items) {
      const article = articles.find(
        (a) => String(a._id) === String(it.articuloId),
      );
      if (!article) continue;
      article.stockDisponible = Math.min(
        article.stockTotal,
        article.stockDisponible + it.cantidad,
      );
      if (returnCondition === LoanReturnCondition.ISSUE) {
        article.estadoObjeto = ArticleObjectStatus.MAINTENANCE;
        article.notas = returnNote
          ? [article.notas, `Devolución con novedad: ${returnNote}`]
              .filter(Boolean)
              .join('\n')
          : article.notas;
      }
      await article.save();
    }

    loan.estado = LoanStatus.RETURNED;
    loan.returnCondition = returnCondition;
    loan.returnNote = returnNote;
    await loan.save();

    await this.notificationModel.create({
      usuarioId: loan.docenteId,
      tipo: NotificationType.SYSTEM,
      titulo: 'Devolución registrada',
      mensaje: 'Se registró la devolución del préstamo.',
      leida: false,
    });

    await this.auditService.record({
      accion: 'loan.returned',
      entidadTipo: AuditEntityType.LOAN,
      entidadId: loan._id,
      entidadNombre: loan.nombreDocente,
      actor,
      metadata: { estado: loan.estado, returnCondition, returnNote },
    });

    return loan.toObject();
  }

  async cancelAsAdmin(id: string, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');

    const loan = await this.loanModel.findById(id);
    if (!loan) throw new NotFoundException('Loan not found');

    if (
      loan.estado === LoanStatus.CANCELLED ||
      loan.estado === LoanStatus.REJECTED ||
      loan.estado === LoanStatus.RETURNED
    ) {
      throw new BadRequestException('El préstamo ya está en un estado final');
    }

    if (
      loan.estado === LoanStatus.APPROVED ||
      loan.estado === LoanStatus.ACTIVE ||
      loan.estado === LoanStatus.OVERDUE
    ) {
      const articleIds = loan.items.map((it) => it.articuloId);
      const articles = await this.articleModel.find({
        _id: { $in: articleIds },
      });
      for (const it of loan.items) {
        const article = articles.find(
          (a) => String(a._id) === String(it.articuloId),
        );
        if (!article) continue;
        article.stockDisponible = Math.min(
          article.stockTotal,
          article.stockDisponible + it.cantidad,
        );
        await article.save();
      }
    }

    loan.estado = LoanStatus.CANCELLED;
    await loan.save();

    await this.notificationModel.create({
      usuarioId: loan.docenteId,
      tipo: NotificationType.SYSTEM,
      titulo: 'Préstamo cancelado',
      mensaje: 'Tu préstamo ha sido cancelado por un administrador.',
      leida: false,
    });

    await this.auditService.record({
      accion: 'loan.cancelled.admin',
      entidadTipo: AuditEntityType.LOAN,
      entidadId: loan._id,
      entidadNombre: loan.nombreDocente,
      actor,
      metadata: { estado: loan.estado },
    });

    return loan.toObject();
  }

  async cancelAsTeacher(docenteId: string, id: string, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(docenteId))
      throw new BadRequestException('Invalid docenteId');
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');

    const loan = await this.loanModel.findById(id);
    if (!loan) throw new NotFoundException('Loan not found');

    if (String(loan.docenteId) !== String(docenteId)) {
      throw new BadRequestException(
        'No puedes cancelar un préstamo que no es tuyo',
      );
    }

    if (
      loan.estado !== LoanStatus.PENDING &&
      loan.estado !== LoanStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Solo se pueden cancelar préstamos solicitados o reservados',
      );
    }

    if (loan.estado === LoanStatus.APPROVED) {
      const articleIds = loan.items.map((it) => it.articuloId);
      const articles = await this.articleModel.find({
        _id: { $in: articleIds },
      });
      for (const it of loan.items) {
        const article = articles.find(
          (a) => String(a._id) === String(it.articuloId),
        );
        if (!article) continue;
        article.stockDisponible = Math.min(
          article.stockTotal,
          article.stockDisponible + it.cantidad,
        );
        await article.save();
      }
    }

    loan.estado = LoanStatus.CANCELLED;
    await loan.save();

    await this.auditService.record({
      accion: 'loan.cancelled.teacher',
      entidadTipo: AuditEntityType.LOAN,
      entidadId: loan._id,
      entidadNombre: loan.nombreDocente,
      actor,
      metadata: { estado: loan.estado },
    });

    return loan.toObject();
  }
}
