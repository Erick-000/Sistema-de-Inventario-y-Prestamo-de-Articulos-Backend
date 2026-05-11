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
import { AuditActor, AuditService } from './audit.service';
import { AuditEntityType } from './schemas/audit-log.schema';
import { ArticleCategoriesService } from './article-categories.service';

export type CreateArticleInput = {
  nombre: string;
  serial?: string;
  categoria: string;
  descripcion?: string;
  ubicacion?: string;
  responsable?: string;
  notas?: string;
  estadoObjeto?: ArticleObjectStatus;
  stockTotal: number;
  stockDisponible: number;
  stockMinimo?: number;
  activo?: boolean;
};

export type UpdateArticleInput = Partial<CreateArticleInput>;

function normalizeCategory(value: unknown) {
  const category = String(value ?? '').trim();
  if (!category || category === 'Hardware') return 'Equipos de cómputo';
  if (category === 'Eléctrica') return 'Energía';
  return category;
}

@Injectable()
export class ArticlesService {
  constructor(
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    private readonly auditService: AuditService,
    private readonly categoriesService: ArticleCategoriesService,
  ) {}

  async findAll(): Promise<Array<Record<string, unknown>>> {
    const articles = await this.articleModel
      .find()
      .sort({ categoria: 1, nombre: 1 })
      .lean();
    return articles.map((article) => ({
      ...article,
      categoria: normalizeCategory(article.categoria),
    }));
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    const article = await this.articleModel.findById(id).lean();
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async create(input: CreateArticleInput, actor?: AuditActor) {
    if (!input?.nombre?.trim())
      throw new BadRequestException('nombre is required');

    if (input.serial !== undefined) {
      const s = String(input.serial ?? '').trim();
      if (s.length === 0) input.serial = undefined;
      else input.serial = s;
    }

    if (!input?.categoria?.trim())
      throw new BadRequestException('categoria is required');
    if (!Number.isFinite(input.stockTotal) || input.stockTotal < 0)
      throw new BadRequestException('stockTotal must be >= 0');
    if (!Number.isFinite(input.stockDisponible) || input.stockDisponible < 0)
      throw new BadRequestException('stockDisponible must be >= 0');
    if (input.stockDisponible > input.stockTotal)
      throw new BadRequestException('stockDisponible cannot exceed stockTotal');

    if (input.stockMinimo !== undefined) {
      if (!Number.isFinite(input.stockMinimo) || input.stockMinimo < 0)
        throw new BadRequestException('stockMinimo must be >= 0');
    }

    try {
      const categoria = normalizeCategory(input.categoria);
      await this.categoriesService.create({ nombre: categoria }, actor);
      const doc = new this.articleModel({
        nombre: input.nombre.trim(),
        serial: input.serial,
        categoria,
        descripcion: input.descripcion,
        ubicacion: input.ubicacion,
        responsable: input.responsable,
        notas: input.notas,
        estadoObjeto: input.estadoObjeto ?? ArticleObjectStatus.OPERATIONAL,
        stockTotal: Math.floor(input.stockTotal),
        stockDisponible: Math.floor(input.stockDisponible),
        stockMinimo: Math.floor(input.stockMinimo ?? 0),
        activo: input.activo ?? true,
      });

      if (!doc.serial) {
        doc.serial = `UIB-${String(doc._id).slice(-6).toUpperCase()}`;
      }

      const created = await doc.save();
      await this.auditService.record({
        accion: 'article.created',
        entidadTipo: AuditEntityType.ARTICLE,
        entidadId: created._id,
        entidadNombre: created.nombre,
        actor,
        metadata: {
          categoria: created.categoria,
          stockTotal: created.stockTotal,
          stockDisponible: created.stockDisponible,
        },
      });
      return created.toObject();
    } catch (err) {
      const msg = String((err as { message?: unknown } | null)?.message ?? err);
      if (msg.includes('E11000') && msg.includes('serial')) {
        throw new BadRequestException('Serial ya registrado');
      }
      throw err;
    }
  }

  async bulkCreate(inputs: CreateArticleInput[], actor?: AuditActor) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new BadRequestException('Se requiere un arreglo de artículos');
    }

    const docs: (CreateArticleInput & { _id: Types.ObjectId })[] = [];
    for (const input of inputs) {
      if (!input?.nombre?.trim())
        throw new BadRequestException('nombre is required in bulk');

      if (input.serial !== undefined) {
        const s = String(input.serial ?? '').trim();
        if (s.length === 0) input.serial = undefined;
        else input.serial = s;
      }

      if (!input?.categoria?.trim())
        throw new BadRequestException('categoria is required in bulk');

      const stockTotal = Number(input.stockTotal);
      const stockDisponible = Number(input.stockDisponible);
      const stockMinimo =
        input.stockMinimo !== undefined ? Number(input.stockMinimo) : 0;

      if (!Number.isFinite(stockTotal) || stockTotal < 0)
        throw new BadRequestException('stockTotal must be >= 0');
      if (!Number.isFinite(stockDisponible) || stockDisponible < 0)
        throw new BadRequestException('stockDisponible must be >= 0');
      if (stockDisponible > stockTotal)
        throw new BadRequestException(
          'stockDisponible cannot exceed stockTotal',
        );
      if (!Number.isFinite(stockMinimo) || stockMinimo < 0)
        throw new BadRequestException('stockMinimo must be >= 0');

      const _id = new Types.ObjectId();
      const categoria = normalizeCategory(input.categoria);
      docs.push({
        _id,
        nombre: input.nombre.trim(),
        serial: input.serial || `UIB-${String(_id).slice(-6).toUpperCase()}`,
        categoria,
        descripcion: input.descripcion,
        ubicacion: input.ubicacion,
        responsable: input.responsable,
        notas: input.notas,
        estadoObjeto: input.estadoObjeto ?? ArticleObjectStatus.OPERATIONAL,
        stockTotal: Math.floor(stockTotal),
        stockDisponible: Math.floor(stockDisponible),
        stockMinimo: Math.floor(stockMinimo),
        activo: input.activo ?? true,
      });
    }

    try {
      await Promise.all(
        [...new Set(docs.map((doc) => doc.categoria))].map((nombre) =>
          this.categoriesService.create({ nombre }, actor),
        ),
      );
      const created = await this.articleModel.insertMany(docs);
      await Promise.all(
        created.map((doc) =>
          this.auditService.record({
            accion: 'article.created.bulk',
            entidadTipo: AuditEntityType.ARTICLE,
            entidadId: doc._id,
            entidadNombre: doc.nombre,
            actor,
            metadata: { categoria: doc.categoria },
          }),
        ),
      );
      return created.map((doc) => doc.toObject());
    } catch (err) {
      const msg = String((err as { message?: unknown } | null)?.message ?? err);
      if (msg.includes('E11000') && msg.includes('serial')) {
        throw new BadRequestException('Uno de los seriales ya está registrado');
      }
      throw err;
    }
  }

  async update(id: string, patch: UpdateArticleInput, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');

    if (patch.serial !== undefined) {
      const s = String(patch.serial ?? '').trim();
      patch.serial = s.length ? s : undefined;
    }

    if (patch.stockTotal !== undefined) {
      if (!Number.isFinite(patch.stockTotal) || patch.stockTotal < 0)
        throw new BadRequestException('stockTotal must be >= 0');
    }
    if (patch.stockDisponible !== undefined) {
      if (!Number.isFinite(patch.stockDisponible) || patch.stockDisponible < 0)
        throw new BadRequestException('stockDisponible must be >= 0');
    }

    if (patch.stockMinimo !== undefined) {
      if (!Number.isFinite(patch.stockMinimo) || patch.stockMinimo < 0)
        throw new BadRequestException('stockMinimo must be >= 0');
    }

    const current = await this.articleModel.findById(id).lean();
    if (!current) throw new NotFoundException('Article not found');

    const newStockTotal =
      patch.stockTotal !== undefined
        ? Math.floor(patch.stockTotal)
        : current.stockTotal;
    const newStockDisponible =
      patch.stockDisponible !== undefined
        ? Math.floor(patch.stockDisponible)
        : current.stockDisponible;

    if (newStockDisponible > newStockTotal) {
      throw new BadRequestException('stockDisponible cannot exceed stockTotal');
    }

    let updated: unknown;
    try {
      if (patch.categoria !== undefined) {
        await this.categoriesService.create(
          { nombre: normalizeCategory(patch.categoria) },
          actor,
        );
      }
      updated = await this.articleModel
        .findByIdAndUpdate(
          id,
          {
            ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
            ...(patch.serial !== undefined ? { serial: patch.serial } : {}),
            ...(patch.categoria !== undefined
              ? { categoria: normalizeCategory(patch.categoria) }
              : {}),
            ...(patch.descripcion !== undefined
              ? { descripcion: patch.descripcion }
              : {}),
            ...(patch.ubicacion !== undefined
              ? { ubicacion: patch.ubicacion }
              : {}),
            ...(patch.responsable !== undefined
              ? { responsable: patch.responsable }
              : {}),
            ...(patch.notas !== undefined ? { notas: patch.notas } : {}),
            ...(patch.estadoObjeto !== undefined
              ? { estadoObjeto: patch.estadoObjeto }
              : {}),
            ...(patch.stockTotal !== undefined
              ? { stockTotal: Math.floor(patch.stockTotal) }
              : {}),
            ...(patch.stockDisponible !== undefined
              ? { stockDisponible: Math.floor(patch.stockDisponible) }
              : {}),
            ...(patch.stockMinimo !== undefined
              ? { stockMinimo: Math.floor(patch.stockMinimo) }
              : {}),
            ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
          },
          { new: true },
        )
        .lean();
      await this.auditService.record({
        accion: 'article.updated',
        entidadTipo: AuditEntityType.ARTICLE,
        entidadId: id,
        entidadNombre: String(
          (updated as { nombre?: unknown } | null)?.nombre ?? current.nombre,
        ),
        actor,
        metadata: {
          patch,
          previous: {
            nombre: current.nombre,
            categoria: current.categoria,
            stockTotal: current.stockTotal,
            stockDisponible: current.stockDisponible,
            activo: current.activo,
          },
        },
      });
    } catch (err) {
      const msg = String((err as { message?: unknown } | null)?.message ?? err);
      if (msg.includes('E11000') && msg.includes('serial')) {
        throw new BadRequestException('Serial ya registrado');
      }
      throw err;
    }

    return updated as Record<string, unknown>;
  }

  async deactivate(id: string, actor?: AuditActor) {
    const updated = await this.update(id, { activo: false }, actor);
    await this.auditService.record({
      accion: 'article.deactivated',
      entidadTipo: AuditEntityType.ARTICLE,
      entidadId: id,
      entidadNombre: String(updated.nombre ?? ''),
      actor,
    });
    return updated;
  }
}
