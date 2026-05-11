import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RoomDocument = HydratedDocument<Room>;

@Schema({ timestamps: true, collection: 'rooms' })
export class Room {
  @Prop({ required: true, trim: true, index: true })
  nombre!: string;

  @Prop({ trim: true })
  ubicacion?: string;

  @Prop({ required: true, min: 0 })
  capacidad!: number;

  @Prop({ trim: true })
  descripcion?: string;

  @Prop({ trim: true })
  elementos?: string;

  @Prop({ required: true, trim: true })
  disponibleDesde!: string;

  @Prop({ required: true, trim: true })
  disponibleHasta!: string;

  @Prop({ default: true, index: true })
  activo!: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index(
  { nombre: 1, ubicacion: 1 },
  { name: 'idx_room_nombre_ubicacion' },
);
