import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LoanDocument = HydratedDocument<Loan>;

export enum LoanStatus {
  PENDING = 'SOLICITADO',
  APPROVED = 'RESERVADO',
  REJECTED = 'RECHAZADA',
  ACTIVE = 'ACTIVO',
  RETURNING = 'EN_DEVOLUCION',
  RETURNED = 'DEVUELTO',
  OVERDUE = 'VENCIDO',
  CANCELLED = 'CANCELADO',
}

export enum LoanReturnCondition {
  OK = 'OK',
  ISSUE = 'ISSUE',
}

@Schema({ _id: false })
export class LoanItem {
  @Prop({ type: Types.ObjectId, ref: 'Article', required: true, index: true })
  articuloId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombreArticulo!: string;

  @Prop({ trim: true })
  serialArticulo?: string;

  @Prop({ required: true, min: 1 })
  cantidad!: number;
}

export const LoanItemSchema = SchemaFactory.createForClass(LoanItem);

@Schema({ timestamps: true, collection: 'loans' })
export class Loan {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  docenteId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombreDocente!: string;

  @Prop({ trim: true })
  programa?: string;

  @Prop({ type: [LoanItemSchema], required: true, default: [] })
  items!: LoanItem[];

  @Prop({ required: true })
  fechaInicio!: Date;

  @Prop({ required: true, index: true })
  fechaLimite!: Date;

  @Prop({ required: true, min: 0, max: 1439, default: 480 })
  startMin!: number;

  @Prop({ required: true, min: 1, max: 1440, default: 1020 })
  endMin!: number;

  @Prop({
    enum: LoanStatus,
    required: true,
    default: LoanStatus.PENDING,
    index: true,
  })
  estado!: LoanStatus;

  @Prop({ trim: true })
  notaAdmin?: string;

  @Prop({ enum: LoanReturnCondition, trim: true })
  returnCondition?: LoanReturnCondition;

  @Prop({ trim: true })
  returnNote?: string;
}

export const LoanSchema = SchemaFactory.createForClass(Loan);

LoanSchema.index(
  { estado: 1, fechaLimite: 1 },
  { name: 'idx_prestamo_estado_fechaLimite' },
);
LoanSchema.index(
  { docenteId: 1, estado: 1 },
  { name: 'idx_prestamo_docente_estado' },
);
