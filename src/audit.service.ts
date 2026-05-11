import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuditEntityType,
  AuditLog,
  AuditLogDocument,
} from './schemas/audit-log.schema';

export type AuditActor = {
  id?: string;
  nombre?: string;
};

export type AuditInput = {
  accion: string;
  entidadTipo: AuditEntityType;
  entidadId: string | Types.ObjectId;
  entidadNombre?: string;
  actor?: AuditActor;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async record(input: AuditInput) {
    const entidadId =
      input.entidadId instanceof Types.ObjectId
        ? input.entidadId
        : new Types.ObjectId(String(input.entidadId));

    const actorId =
      input.actor?.id && Types.ObjectId.isValid(input.actor.id)
        ? new Types.ObjectId(input.actor.id)
        : undefined;

    return this.auditModel.create({
      accion: input.accion,
      entidadTipo: input.entidadTipo,
      entidadId,
      entidadNombre: input.entidadNombre,
      actorId,
      actorNombre: input.actor?.nombre,
      metadata: input.metadata,
    });
  }

  async list(filters: {
    entidadTipo?: AuditEntityType;
    entidadId?: string;
    limit?: number;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.entidadTipo) query.entidadTipo = filters.entidadTipo;
    if (filters.entidadId && Types.ObjectId.isValid(filters.entidadId)) {
      query.entidadId = new Types.ObjectId(filters.entidadId);
    }

    return this.auditModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(Number(filters.limit ?? 80), 1), 200))
      .lean();
  }
}
