import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import {
  RoomReservation,
  RoomReservationDocument,
  RoomReservationStatus,
} from './schemas/room-reservation.schema';
import {
  RoomReservationBlock,
  RoomReservationBlockDocument,
} from './schemas/room-reservation-block.schema';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { AuditActor, AuditService } from './audit.service';
import { AuditEntityType } from './schemas/audit-log.schema';

function parseTimeToMinutes(value: string) {
  const s = String(value ?? '').trim();
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh * 60 + mm;
}

function normalizeDate(value: string) {
  const s = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function ceilToSlot(min: number, slotSizeMin: number) {
  return Math.floor((min + slotSizeMin - 1) / slotSizeMin);
}

export type CreateRoomReservationInput = {
  salonId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  nota?: string;
};

export type CreateRoomBlockInput = {
  salonId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo: string;
};

@Injectable()
export class RoomReservationsService {
  private readonly slotSizeMin = 15;

  constructor(
    @InjectModel(RoomReservation.name)
    private readonly reservationModel: Model<RoomReservationDocument>,
    @InjectModel(RoomReservationBlock.name)
    private readonly blockModel: Model<RoomReservationBlockDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly auditService: AuditService,
  ) {}

  async listAll() {
    return this.reservationModel.find().sort({ createdAt: -1 }).lean();
  }

  async listMine(docenteId: string) {
    if (!Types.ObjectId.isValid(docenteId))
      throw new BadRequestException('Invalid docenteId');
    return this.reservationModel
      .find({ docenteId: new Types.ObjectId(docenteId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    const r = await this.reservationModel.findById(id).lean();
    if (!r) throw new NotFoundException('Reservation not found');
    return r;
  }

  async listAvailability(salonId: string, fecha: string) {
    if (!Types.ObjectId.isValid(salonId))
      throw new BadRequestException('Invalid salonId');
    const normalizedFecha = normalizeDate(fecha);
    if (!normalizedFecha) throw new BadRequestException('fecha inválida');

    return this.reservationModel
      .find({
        salonId: new Types.ObjectId(salonId),
        fecha: normalizedFecha,
        estado: {
          $in: [RoomReservationStatus.APPROVED, RoomReservationStatus.PENDING],
        },
      })
      .sort({ startMin: 1 })
      .select('nombreSalon fecha startMin endMin estado')
      .lean();
  }

  async listWeek(start: string) {
    const startDate = normalizeDate(start);
    if (!startDate) throw new BadRequestException('fecha inicial inválida');
    const from = new Date(`${startDate}T00:00:00.000Z`);
    const dates = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(from);
      d.setUTCDate(from.getUTCDate() + index);
      return d.toISOString().slice(0, 10);
    });

    return this.reservationModel
      .find({
        fecha: { $in: dates },
        estado: {
          $in: [RoomReservationStatus.APPROVED, RoomReservationStatus.PENDING],
        },
      })
      .sort({ fecha: 1, startMin: 1, nombreSalon: 1 })
      .lean();
  }

  private async assertTeacher(docenteId: string) {
    const teacher = await this.userModel.findById(docenteId).lean();
    if (!teacher) throw new NotFoundException('Docente not found');
    if (teacher.rol !== UserRole.TEACHER)
      throw new BadRequestException('Solo docentes pueden reservar salones');
    if (teacher.bloqueado) throw new BadRequestException('Usuario bloqueado');
    return teacher;
  }

  async create(docenteId: string, input: CreateRoomReservationInput, actor?: AuditActor) {
    await this.assertTeacher(docenteId);

    if (!Types.ObjectId.isValid(input?.salonId))
      throw new BadRequestException('Invalid salonId');

    const fecha = normalizeDate(input.fecha);
    if (!fecha) throw new BadRequestException('fecha inválida');

    const startMin = parseTimeToMinutes(input.horaInicio);
    const endMin = parseTimeToMinutes(input.horaFin);
    if (startMin === null) throw new BadRequestException('horaInicio inválida');
    if (endMin === null) throw new BadRequestException('horaFin inválida');
    if (endMin <= startMin)
      throw new BadRequestException('Rango horario inválido');

    const room = await this.roomModel.findById(input.salonId).lean();
    if (!room) throw new NotFoundException('Room not found');
    if (!room.activo) throw new BadRequestException('Salón inactivo');

    const roomDesde = parseTimeToMinutes(room.disponibleDesde);
    const roomHasta = parseTimeToMinutes(room.disponibleHasta);
    if (roomDesde === null || roomHasta === null || roomHasta <= roomDesde)
      throw new BadRequestException('Horario del salón inválido');

    if (startMin < roomDesde || endMin > roomHasta)
      throw new BadRequestException(
        'Horario fuera de disponibilidad del salón',
      );

    const overlapApproved = await this.reservationModel
      .findOne({
        salonId: new Types.ObjectId(input.salonId),
        fecha,
        estado: {
          $in: [RoomReservationStatus.APPROVED, RoomReservationStatus.PENDING],
        },
        startMin: { $lt: endMin },
        endMin: { $gt: startMin },
      })
      .lean();

    if (overlapApproved)
      throw new BadRequestException(
        'Cruce de reserva: el salón ya está reservado',
      );

    const created = await this.reservationModel.create({
      salonId: new Types.ObjectId(input.salonId),
      nombreSalon: room.nombre,
      docenteId: new Types.ObjectId(docenteId),
      nombreDocente:
        (await this.userModel.findById(docenteId).lean())?.nombreCompleto ??
        'Docente',
      fecha,
      startMin,
      endMin,
      nota: input.nota?.trim() ? input.nota.trim() : undefined,
      estado: RoomReservationStatus.PENDING,
    });

    await this.auditService.record({
      accion: 'room_reservation.requested',
      entidadTipo: AuditEntityType.ROOM_RESERVATION,
      entidadId: created._id,
      entidadNombre: room.nombre,
      actor,
      metadata: {
        fecha,
        horaInicio: input.horaInicio,
        horaFin: input.horaFin,
      },
    });

    return created.toObject();
  }

  async createBlock(input: CreateRoomBlockInput, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(input?.salonId))
      throw new BadRequestException('Invalid salonId');

    const fecha = normalizeDate(input.fecha);
    if (!fecha) throw new BadRequestException('fecha inválida');

    const startMin = parseTimeToMinutes(input.horaInicio);
    const endMin = parseTimeToMinutes(input.horaFin);
    if (startMin === null) throw new BadRequestException('horaInicio inválida');
    if (endMin === null) throw new BadRequestException('horaFin inválida');
    if (endMin <= startMin)
      throw new BadRequestException('Rango horario inválido');
    if (!input.motivo?.trim() || input.motivo.trim().length < 5)
      throw new BadRequestException('motivo must be at least 5 chars');

    const room = await this.roomModel.findById(input.salonId).lean();
    if (!room) throw new NotFoundException('Room not found');

    const overlap = await this.reservationModel
      .findOne({
        salonId: new Types.ObjectId(input.salonId),
        fecha,
        estado: {
          $in: [RoomReservationStatus.APPROVED, RoomReservationStatus.PENDING],
        },
        startMin: { $lt: endMin },
        endMin: { $gt: startMin },
      })
      .lean();
    if (overlap)
      throw new BadRequestException(
        'Cruce de reserva: el salón ya tiene una reserva o bloqueo',
      );

    const reservaId = new Types.ObjectId();
    const blocks = this.buildBlocks(
      new Types.ObjectId(input.salonId),
      fecha,
      startMin,
      endMin,
      reservaId,
    );
    if (blocks.length > 0) {
      try {
        await this.blockModel.insertMany(blocks, { ordered: true });
      } catch (err) {
        const msg = String((err as { message?: unknown } | null)?.message ?? err);
        if (msg.includes('E11000')) {
          throw new BadRequestException(
            'Cruce de reserva: el salón ya tiene una reserva o bloqueo',
          );
        }
        throw err;
      }
    }

    const created = await this.reservationModel.create({
      _id: reservaId,
      salonId: new Types.ObjectId(input.salonId),
      nombreSalon: room.nombre,
      docenteId:
        actor?.id && Types.ObjectId.isValid(actor.id)
          ? new Types.ObjectId(actor.id)
          : new Types.ObjectId(),
      nombreDocente: 'Bloqueo institucional',
      fecha,
      startMin,
      endMin,
      nota: input.motivo.trim(),
      estado: RoomReservationStatus.APPROVED,
    });

    await this.auditService.record({
      accion: 'room_block.created',
      entidadTipo: AuditEntityType.ROOM_RESERVATION,
      entidadId: created._id,
      entidadNombre: room.nombre,
      actor,
      metadata: {
        fecha,
        motivo: input.motivo.trim(),
        horaInicio: input.horaInicio,
        horaFin: input.horaFin,
      },
    });

    return created.toObject();
  }

  private buildBlocks(
    salonId: Types.ObjectId,
    fecha: string,
    startMin: number,
    endMin: number,
    reservaId: Types.ObjectId,
  ) {
    const startSlot = Math.floor(startMin / this.slotSizeMin);
    const endSlot = ceilToSlot(endMin, this.slotSizeMin);
    const blocks = [] as Array<{
      salonId: Types.ObjectId;
      fecha: string;
      slot: number;
      reservaId: Types.ObjectId;
    }>;

    for (let slot = startSlot; slot < endSlot; slot++) {
      blocks.push({ salonId, fecha, slot, reservaId });
    }

    return blocks;
  }

  async approve(id: string, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    const reservation = await this.reservationModel.findById(id);
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.estado === RoomReservationStatus.CANCELLED)
      throw new BadRequestException(
        'No se puede aprobar una reserva cancelada',
      );
    if (reservation.estado === RoomReservationStatus.REJECTED)
      throw new BadRequestException(
        'No se puede aprobar una reserva rechazada',
      );
    if (reservation.estado === RoomReservationStatus.APPROVED)
      return reservation.toObject();

    const overlapApproved = await this.reservationModel
      .findOne({
        salonId: reservation.salonId,
        fecha: reservation.fecha,
        estado: RoomReservationStatus.APPROVED,
        startMin: { $lt: reservation.endMin },
        endMin: { $gt: reservation.startMin },
      })
      .lean();

    if (overlapApproved)
      throw new BadRequestException(
        'Cruce de reserva: el salón ya está reservado',
      );

    const blocks = this.buildBlocks(
      reservation.salonId,
      reservation.fecha,
      reservation.startMin,
      reservation.endMin,
      reservation._id,
    );

    try {
      if (blocks.length > 0) {
        await this.blockModel.insertMany(blocks, { ordered: true });
      }
    } catch (err) {
      const msg = String((err as { message?: unknown } | null)?.message ?? err);
      if (msg.includes('E11000')) {
        throw new BadRequestException(
          'Cruce de reserva: el salón ya está reservado',
        );
      }
      throw err;
    }

    reservation.estado = RoomReservationStatus.APPROVED;
    await reservation.save();
    await this.auditService.record({
      accion: 'room_reservation.approved',
      entidadTipo: AuditEntityType.ROOM_RESERVATION,
      entidadId: reservation._id,
      entidadNombre: reservation.nombreSalon,
      actor,
      metadata: { fecha: reservation.fecha },
    });
    return reservation.toObject();
  }

  async reject(id: string, motivo?: string, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    const reservation = await this.reservationModel.findById(id);
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.estado === RoomReservationStatus.CANCELLED)
      throw new BadRequestException(
        'No se puede rechazar una reserva cancelada',
      );
    if (reservation.estado === RoomReservationStatus.APPROVED)
      throw new BadRequestException(
        'No se puede rechazar una reserva aprobada',
      );

    reservation.estado = RoomReservationStatus.REJECTED;
    if (motivo?.trim()) reservation.nota = motivo.trim();
    await reservation.save();
    await this.auditService.record({
      accion: 'room_reservation.rejected',
      entidadTipo: AuditEntityType.ROOM_RESERVATION,
      entidadId: reservation._id,
      entidadNombre: reservation.nombreSalon,
      actor,
      metadata: { motivo: reservation.nota },
    });
    return reservation.toObject();
  }

  async cancelAsAdmin(id: string, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    const reservation = await this.reservationModel.findById(id);
    if (!reservation) throw new NotFoundException('Reservation not found');

    reservation.estado = RoomReservationStatus.CANCELLED;
    await reservation.save();
    await this.blockModel.deleteMany({ reservaId: reservation._id });
    await this.auditService.record({
      accion: 'room_reservation.cancelled.admin',
      entidadTipo: AuditEntityType.ROOM_RESERVATION,
      entidadId: reservation._id,
      entidadNombre: reservation.nombreSalon,
      actor,
    });
    return reservation.toObject();
  }

  async cancelAsTeacher(docenteId: string, id: string, actor?: AuditActor) {
    if (!Types.ObjectId.isValid(docenteId))
      throw new BadRequestException('Invalid docenteId');
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');

    const reservation = await this.reservationModel.findById(id);
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (String(reservation.docenteId) !== String(docenteId)) {
      throw new BadRequestException(
        'No puedes cancelar una reserva que no es tuya',
      );
    }

    if (reservation.estado === RoomReservationStatus.REJECTED)
      throw new BadRequestException(
        'No se puede cancelar una reserva rechazada',
      );

    reservation.estado = RoomReservationStatus.CANCELLED;
    await reservation.save();
    await this.blockModel.deleteMany({ reservaId: reservation._id });
    await this.auditService.record({
      accion: 'room_reservation.cancelled.teacher',
      entidadTipo: AuditEntityType.ROOM_RESERVATION,
      entidadId: reservation._id,
      entidadNombre: reservation.nombreSalon,
      actor,
    });
    return reservation.toObject();
  }
}
