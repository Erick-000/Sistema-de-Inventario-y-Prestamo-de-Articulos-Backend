import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ArticleCategoryDocument = HydratedDocument<ArticleCategory>;

@Schema({ timestamps: true, collection: 'article_categories' })
export class ArticleCategory {
  @Prop({ required: true, trim: true, unique: true, index: true })
  nombre!: string;

  @Prop({ trim: true })
  descripcion?: string;

  @Prop({ default: true, index: true })
  activo!: boolean;

  @Prop({ default: true })
  prestable!: boolean;

  @Prop({ default: 240, min: 15, max: 480 })
  maxLoanMinutes!: number;

  @Prop({ default: false })
  requiereSerial!: boolean;
}

export const ArticleCategorySchema =
  SchemaFactory.createForClass(ArticleCategory);
