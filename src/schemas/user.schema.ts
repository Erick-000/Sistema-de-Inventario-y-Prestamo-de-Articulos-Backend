import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  STUDENT = 'estudiante',
  TEACHER = 'docente',
  ADMIN = 'admin',
}

export enum TipoDocumento {
  CC = 'CC',
  TI = 'TI',
  CE = 'CE',
  PAS = 'PAS',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  nombreCompleto!: string;

  @Prop({
    enum: TipoDocumento,
    trim: true,
    uppercase: true,
    index: true,
    sparse: true,
  })
  tipoDocumento?: TipoDocumento;

  @Prop({ trim: true, index: true, unique: true, sparse: true })
  numeroDocumento?: string;

  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true,
  })
  correo!: string;

  @Prop({ required: true })
  hashContrasena!: string;

  @Prop({
    enum: UserRole,
    required: true,
    default: UserRole.STUDENT,
    index: true,
  })
  rol!: UserRole;

  @Prop({ trim: true, index: true, unique: true, sparse: true })
  codigoEstudiantil?: string;

  @Prop({ trim: true, index: true })
  programa?: string;

  @Prop({ default: false, index: true })
  bloqueado!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
