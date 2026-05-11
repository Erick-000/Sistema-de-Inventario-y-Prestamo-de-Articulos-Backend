import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoomReservationBlockDocument =
  HydratedDocument<RoomReservationBlock>;

@Schema({ timestamps: true, collection: 'room_reservation_blocks' })
export class RoomReservationBlock {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  salonId!: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  fecha!: string;

  @Prop({ required: true, min: 0, index: true })
  slot!: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'RoomReservation',
    required: true,
    index: true,
  })
  reservaId!: Types.ObjectId;
}

export const RoomReservationBlockSchema =
  SchemaFactory.createForClass(RoomReservationBlock);

RoomReservationBlockSchema.index(
  { salonId: 1, fecha: 1, slot: 1 },
  { unique: true, name: 'uniq_room_block_salon_fecha_slot' },
);
