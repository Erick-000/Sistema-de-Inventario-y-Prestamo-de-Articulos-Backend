import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Roles } from './roles.decorator';
import { ArticleCategoriesService } from './article-categories.service';

type AuthedReq = {
  user?: {
    id?: string;
    name?: string;
  };
};

@Controller('article-categories')
export class ArticleCategoriesController {
  constructor(private readonly service: ArticleCategoriesService) {}

  @Get()
  async list(@Query('includeInactive') includeInactive?: string) {
    return this.service.list(includeInactive === 'true');
  }

  @Post()
  @Roles('admin')
  async create(
    @Req() req: AuthedReq,
    @Body()
    body: {
      nombre?: string;
      descripcion?: string;
      prestable?: boolean;
      maxLoanMinutes?: number;
      requiereSerial?: boolean;
    },
  ) {
    return this.service.create(body, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      descripcion?: string;
      activo?: boolean;
      prestable?: boolean;
      maxLoanMinutes?: number;
      requiereSerial?: boolean;
    },
  ) {
    return this.service.update(id, body, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }
}
