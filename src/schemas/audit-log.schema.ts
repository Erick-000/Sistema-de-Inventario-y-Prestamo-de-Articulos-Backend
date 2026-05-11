import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export enum AuditEntityType {
  ARTICLE = 'article',
  LOAN = 'loan',
  ROOM_RESERVATION = 'room_reservation',
  USER = 'user',
  CATEGORY = 'category',
}

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ required: true, trim: true, index: true })
  accion!: string;

  @Prop({ enum: AuditEntityType, required: true, index: true })
  entidadTipo!: AuditEntityType;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  entidadId!: Types.ObjectId;

  @Prop({ trim: true })
  entidadNombre?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  actorId?: Types.ObjectId;

  @Prop({ trim: true })
  actorNombre?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index(
  { entidadTipo: 1, entidadId: 1, createdAt: -1 },
  { name: 'idx_audit_entity_created' },
);
