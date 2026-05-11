import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';

function parseTimeToMinutes(value: string) {
  const s = String(value ?? '').trim();
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh * 60 + mm;
}

export type CreateRoomInput = {
  nombre: string;
  ubicacion?: string;
  capacidad: number;
  descripcion?: string;
  elementos?: string;
  disponibleDesde: string;
  disponibleHasta: string;
  activo?: boolean;
};

export type UpdateRoomInput = Partial<CreateRoomInput>;

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
  ) {}

  async list() {
    return this.roomModel.find().sort({ createdAt: -1 }).lean();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    const room = await this.roomModel.findById(id).lean();
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async create(input: CreateRoomInput) {
    if (!input?.nombre?.trim())
      throw new BadRequestException('nombre is required');

    const capacidad = Math.floor(Number(input.capacidad));
    if (!Number.isFinite(capacidad) || capacidad < 0)
      throw new BadRequestException('capacidad must be >= 0');

    const desde = parseTimeToMinutes(input.disponibleDesde);
    const hasta = parseTimeToMinutes(input.disponibleHasta);
    if (desde === null)
      throw new BadRequestException('disponibleDesde inválido');
    if (hasta === null)
      throw new BadRequestException('disponibleHasta inválido');
    if (hasta <= desde) throw new BadRequestException('Rango horario inválido');

    const created = await this.roomModel.create({
      nombre: input.nombre.trim(),
      ubicacion: input.ubicacion?.trim() ? input.ubicacion.trim() : undefined,
      capacidad,
      descripcion: input.descripcion?.trim()
        ? input.descripcion.trim()
        : undefined,
      elementos: input.elementos?.trim() ? input.elementos.trim() : undefined,
      disponibleDesde: String(input.disponibleDesde).trim(),
      disponibleHasta: String(input.disponibleHasta).trim(),
      activo: input.activo ?? true,
    });

    return created.toObject();
  }

  async update(id: string, patch: UpdateRoomInput) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');

    if (patch.capacidad !== undefined) {
      const capacidad = Math.floor(Number(patch.capacidad));
      if (!Number.isFinite(capacidad) || capacidad < 0)
        throw new BadRequestException('capacidad must be >= 0');
      patch.capacidad = capacidad;
    }

    const desde =
      patch.disponibleDesde !== undefined
        ? parseTimeToMinutes(patch.disponibleDesde)
        : null;
    const hasta =
      patch.disponibleHasta !== undefined
        ? parseTimeToMinutes(patch.disponibleHasta)
        : null;
    if (patch.disponibleDesde !== undefined && desde === null)
      throw new BadRequestException('disponibleDesde inválido');
    if (patch.disponibleHasta !== undefined && hasta === null)
      throw new BadRequestException('disponibleHasta inválido');

    const updated = await this.roomModel
      .findByIdAndUpdate(
        id,
        {
          ...(patch.nombre !== undefined
            ? { nombre: patch.nombre.trim() }
            : {}),
          ...(patch.ubicacion !== undefined
            ? {
                ubicacion: patch.ubicacion?.trim()
                  ? patch.ubicacion.trim()
                  : undefined,
              }
            : {}),
          ...(patch.capacidad !== undefined
            ? { capacidad: patch.capacidad }
            : {}),
          ...(patch.descripcion !== undefined
            ? {
                descripcion: patch.descripcion?.trim()
                  ? patch.descripcion.trim()
                  : undefined,
              }
            : {}),
          ...(patch.elementos !== undefined
            ? {
                elementos: patch.elementos?.trim()
                  ? patch.elementos.trim()
                  : undefined,
              }
            : {}),
          ...(patch.disponibleDesde !== undefined
            ? { disponibleDesde: String(patch.disponibleDesde).trim() }
            : {}),
          ...(patch.disponibleHasta !== undefined
            ? { disponibleHasta: String(patch.disponibleHasta).trim() }
            : {}),
          ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
        },
        { new: true },
      )
      .lean();

    if (!updated) throw new NotFoundException('Room not found');

    const currentDesde = parseTimeToMinutes(
      (updated as { disponibleDesde?: unknown }).disponibleDesde as string,
    );
    const currentHasta = parseTimeToMinutes(
      (updated as { disponibleHasta?: unknown }).disponibleHasta as string,
    );
    if (
      currentDesde === null ||
      currentHasta === null ||
      currentHasta <= currentDesde
    )
      throw new BadRequestException('Rango horario inválido');

    return updated;
  }

  async deactivate(id: string) {
    return this.update(id, { activo: false });
  }
}
