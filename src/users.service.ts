import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { AuditActor, AuditService } from './audit.service';
import { AuditEntityType } from './schemas/audit-log.schema';
import { Loan, LoanDocument } from './schemas/loan.schema';
import {
  RoomReservation,
  RoomReservationDocument,
} from './schemas/room-reservation.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Loan.name)
    private readonly loanModel: Model<LoanDocument>,
    @InjectModel(RoomReservation.name)
    private readonly reservationModel: Model<RoomReservationDocument>,
    private readonly auditService: AuditService,
  ) {}

  async findTeachers() {
    return this.userModel
      .find({ rol: UserRole.TEACHER })
      .sort({ nombreCompleto: 1 })
      .lean();
  }

  async findManageableUsers() {
    return this.userModel
      .find({ rol: { $in: [UserRole.TEACHER, UserRole.ADMIN] } })
      .sort({ rol: 1, nombreCompleto: 1 })
      .select('nombreCompleto programa correo rol bloqueado createdAt')
      .lean();
  }

  async updateBlocked(id: string, blocked: boolean, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }
    const current = await this.userModel.findById(id);
    if (!current) throw new NotFoundException('User not found');
    if (current.rol === UserRole.ADMIN && blocked) {
      throw new BadRequestException('No se puede bloquear a un administrador');
    }

    current.bloqueado = Boolean(blocked);
    await current.save();
    await this.auditService.record({
      accion: current.bloqueado ? 'user.blocked' : 'user.unblocked',
      entidadTipo: AuditEntityType.USER,
      entidadId: current._id,
      entidadNombre: current.nombreCompleto,
      actor,
      metadata: { rol: current.rol },
    });

    return {
      _id: current._id,
      nombreCompleto: current.nombreCompleto,
      programa: current.programa,
      correo: current.correo,
      rol: current.rol,
      bloqueado: current.bloqueado,
    };
  }

  async profile(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id');
    }
    const user = await this.userModel
      .findById(id)
      .select('nombreCompleto programa correo rol bloqueado createdAt')
      .lean();
    if (!user) throw new NotFoundException('User not found');

    const userId = new Types.ObjectId(id);
    const [loans, reservations, audit] = await Promise.all([
      this.loanModel.find({ docenteId: userId }).sort({ createdAt: -1 }).limit(30).lean(),
      this.reservationModel
        .find({ docenteId: userId })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      this.auditService.list({
        entidadTipo: AuditEntityType.USER,
        entidadId: id,
        limit: 30,
      }),
    ]);

    return { user, loans, reservations, audit };
  }
}
