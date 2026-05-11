import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import type {
  CreateArticleInput,
  UpdateArticleInput,
} from './articles.service';
import { Roles } from './roles.decorator';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  async list(): Promise<Array<Record<string, unknown>>> {
    return this.articlesService.findAll();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.articlesService.findById(id);
  }

  @Post()
  @Roles('admin')
  async create(
    @Req() req: { user?: { id?: string; name?: string } },
    @Body() body: CreateArticleInput,
  ) {
    return this.articlesService.create(body, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }

  @Post('bulk')
  @Roles('admin')
  async bulkCreate(
    @Req() req: { user?: { id?: string; name?: string } },
    @Body() body: CreateArticleInput[],
  ) {
    return this.articlesService.bulkCreate(body, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Req() req: { user?: { id?: string; name?: string } },
    @Param('id') id: string,
    @Body() body: UpdateArticleInput,
  ) {
    return this.articlesService.update(id, body, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }

  @Delete(':id')
  @Roles('admin')
  async deactivate(
    @Req() req: { user?: { id?: string; name?: string } },
    @Param('id') id: string,
    @Query('hard') _hard?: string,
  ) {
    if (_hard) {
      // no-op (compat)
    }
    return this.articlesService.deactivate(id, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }
}
