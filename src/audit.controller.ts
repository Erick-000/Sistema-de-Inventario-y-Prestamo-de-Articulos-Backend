import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditEntityType } from './schemas/audit-log.schema';
import { Roles } from './roles.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('admin')
  async list(
    @Query('entityType') entityType?: AuditEntityType,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.list({
      entidadTipo: entityType,
      entidadId: entityId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
