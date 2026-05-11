import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoomReservationDocument = HydratedDocument<RoomReservation>;

export enum RoomReservationStatus {
  PENDING = 'SOLICITADO',
  APPROVED = 'RESERVADO',
  REJECTED = 'RECHAZADA',
  CANCELLED = 'CANCELADA',
}

@Schema({ timestamps: true, collection: 'room_reservations' })
export class RoomReservation {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  salonId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombreSalon!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  docenteId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombreDocente!: string;

  @Prop({ required: true, trim: true, index: true })
  fecha!: string;

  @Prop({ required: true, min: 0, index: true })
  startMin!: number;

  @Prop({ required: true, min: 0, index: true })
  endMin!: number;

  @Prop({ trim: true })
  nota?: string;

  @Prop({
    enum: RoomReservationStatus,
    required: true,
    default: RoomReservationStatus.PENDING,
    index: true,
  })
  estado!: RoomReservationStatus;
}

export const RoomReservationSchema =
  SchemaFactory.createForClass(RoomReservation);

RoomReservationSchema.index(
  { salonId: 1, fecha: 1, startMin: 1, endMin: 1, estado: 1 },
  { name: 'idx_room_reservation_salon_fecha_time_estado' },
);
