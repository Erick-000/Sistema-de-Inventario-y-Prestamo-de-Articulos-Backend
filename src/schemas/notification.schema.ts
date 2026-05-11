import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  OVERDUE = 'OVERDUE',
  REQUEST = 'REQUEST',
  INVENTORY = 'INVENTORY',
  SYSTEM = 'SYSTEM',
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  usuarioId?: Types.ObjectId;

  @Prop({ enum: NotificationType, required: true, index: true })
  tipo!: NotificationType;

  @Prop({ required: true, trim: true })
  titulo!: string;

  @Prop({ required: true, trim: true })
  mensaje!: string;

  @Prop({ default: false, index: true })
  leida!: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index(
  { usuarioId: 1, leida: 1, createdAt: -1 },
  { name: 'idx_notificacion_usuario_leida_createdAt' },
);
