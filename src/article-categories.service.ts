import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ArticleCategory,
  ArticleCategoryDocument,
} from './schemas/article-category.schema';
import { AuditService, AuditActor } from './audit.service';
import { AuditEntityType } from './schemas/audit-log.schema';

const DEFAULT_CATEGORIES = [
  'Equipos de cómputo',
  'Audiovisuales',
  'Conectividad',
  'Energía',
  'Herramientas',
  'Mobiliario',
  'Controles',
  'Periféricos',
  'Cables',
  'Consumibles',
  'Otros',
];

export function defaultCategoryRules(nombre: string) {
  const name = normalizeName(nombre);
  if (name === 'Controles') {
    return { prestable: true, maxLoanMinutes: 60, requiereSerial: true };
  }
  if (name === 'Cables' || name === 'Conectividad' || name === 'Energía') {
    return { prestable: true, maxLoanMinutes: 120, requiereSerial: false };
  }
  if (name === 'Consumibles') {
    return { prestable: false, maxLoanMinutes: 15, requiereSerial: false };
  }
  if (
    name === 'Equipos de cómputo' ||
    name === 'Audiovisuales' ||
    name === 'Periféricos'
  ) {
    return { prestable: true, maxLoanMinutes: 240, requiereSerial: true };
  }
  return { prestable: true, maxLoanMinutes: 240, requiereSerial: false };
}

function normalizeName(value: unknown) {
  const name = String(value ?? '').trim();
  if (!name || name === 'Hardware') return 'Equipos de cómputo';
  if (name === 'Eléctrica') return 'Energía';
  return name;
}

@Injectable()
export class ArticleCategoriesService {
  constructor(
    @InjectModel(ArticleCategory.name)
    private readonly categoryModel: Model<ArticleCategoryDocument>,
    private readonly auditService: AuditService,
  ) {}

  async ensureDefaults() {
    await Promise.all(
      DEFAULT_CATEGORIES.map((nombre) =>
        this.categoryModel.updateOne(
          { nombre },
          {
            $setOnInsert: {
              nombre,
              activo: true,
              ...defaultCategoryRules(nombre),
            },
          },
          { upsert: true },
        ),
      ),
    );
  }

  async list(includeInactive = false) {
    await this.ensureDefaults();
    const query = includeInactive ? {} : { activo: true };
    return this.categoryModel
      .find(query)
      .sort({ activo: -1, nombre: 1 })
      .lean();
  }

  async create(
    input: {
      nombre?: string;
      descripcion?: string;
      prestable?: boolean;
      maxLoanMinutes?: number;
      requiereSerial?: boolean;
    },
    actor?: AuditActor,
  ) {
    const nombre = normalizeName(input.nombre);
    if (!nombre) throw new BadRequestException('nombre is required');

    const existing = await this.categoryModel.findOne({ nombre });
    if (existing) {
      existing.activo = true;
      if (input.descripcion !== undefined) {
        existing.descripcion = input.descripcion?.trim() || undefined;
      }
      if (input.prestable !== undefined) existing.prestable = Boolean(input.prestable);
      if (input.maxLoanMinutes !== undefined) {
        existing.maxLoanMinutes = Math.max(
          15,
          Math.min(480, Math.floor(Number(input.maxLoanMinutes))),
        );
      }
      if (input.requiereSerial !== undefined) {
        existing.requiereSerial = Boolean(input.requiereSerial);
      }
      await existing.save();
      return existing.toObject();
    }

    const defaults = defaultCategoryRules(nombre);
    const created = await this.categoryModel.create({
      nombre,
      descripcion: input.descripcion?.trim() || undefined,
      activo: true,
      prestable: input.prestable ?? defaults.prestable,
      maxLoanMinutes: Math.max(
        15,
        Math.min(480, Math.floor(Number(input.maxLoanMinutes ?? defaults.maxLoanMinutes))),
      ),
      requiereSerial: input.requiereSerial ?? defaults.requiereSerial,
    });
    await this.auditService.record({
      accion: 'category.created',
      entidadTipo: AuditEntityType.CATEGORY,
      entidadId: created._id,
      entidadNombre: created.nombre,
      actor,
    });
    return created.toObject();
  }

  async update(
    id: string,
    patch: {
      nombre?: string;
      descripcion?: string;
      activo?: boolean;
      prestable?: boolean;
      maxLoanMinutes?: number;
      requiereSerial?: boolean;
    },
    actor?: AuditActor,
  ) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id');
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    if (patch.nombre !== undefined) category.nombre = normalizeName(patch.nombre);
    if (patch.descripcion !== undefined) {
      category.descripcion = patch.descripcion.trim() || undefined;
    }
    if (patch.activo !== undefined) category.activo = Boolean(patch.activo);
    if (patch.prestable !== undefined) category.prestable = Boolean(patch.prestable);
    if (patch.maxLoanMinutes !== undefined) {
      category.maxLoanMinutes = Math.max(
        15,
        Math.min(480, Math.floor(Number(patch.maxLoanMinutes))),
      );
    }
    if (patch.requiereSerial !== undefined) {
      category.requiereSerial = Boolean(patch.requiereSerial);
    }

    await category.save();
    await this.auditService.record({
      accion: 'category.updated',
      entidadTipo: AuditEntityType.CATEGORY,
      entidadId: category._id,
      entidadNombre: category.nombre,
      actor,
      metadata: patch,
    });
    return category.toObject();
  }
}
