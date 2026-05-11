import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ArticleDocument = HydratedDocument<Article>;

export enum ArticleCategory {
  COMPUTERS = 'Equipos de cómputo',
  AUDIOVISUAL = 'Audiovisuales',
  CONNECTIVITY = 'Conectividad',
  ENERGY = 'Energía',
  FURNITURE = 'Mobiliario',
  PERIPHERALS = 'Periféricos',
  CABLES = 'Cables',
  ELECTRIC = 'Eléctrica',
  TOOLS = 'Herramientas',
  CONTROLS = 'Controles',
  OTHER = 'Otros',
}

export enum ArticleObjectStatus {
  OPERATIONAL = 'OPERATIVO',
  MAINTENANCE = 'MANTENIMIENTO',
  RETIRED = 'BAJA',
}

@Schema({ timestamps: true, collection: 'articles' })
export class Article {
  @Prop({ required: true, trim: true, index: true })
  nombre!: string;

  @Prop({ trim: true, index: true, unique: true, sparse: true })
  serial?: string;

  @Prop({ required: true, trim: true, index: true })
  categoria!: string;

  @Prop({ trim: true })
  descripcion?: string;

  @Prop({ trim: true, index: true })
  ubicacion?: string;

  @Prop({ trim: true, index: true })
  responsable?: string;

  @Prop({ trim: true })
  notas?: string;

  @Prop({
    enum: ArticleObjectStatus,
    required: true,
    default: ArticleObjectStatus.OPERATIONAL,
    index: true,
  })
  estadoObjeto!: ArticleObjectStatus;

  @Prop({ required: true, min: 0 })
  stockTotal!: number;

  @Prop({ required: true, min: 0 })
  stockDisponible!: number;

  @Prop({ default: 0, min: 0 })
  stockMinimo!: number;

  @Prop({ default: true, index: true })
  activo!: boolean;
}

export const ArticleSchema = SchemaFactory.createForClass(Article);

ArticleSchema.index(
  { nombre: 1, categoria: 1 },
  { name: 'idx_article_nombre_categoria' },
);
