import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { LoanStatus } from './schemas/loan.schema';
import { LoansService } from './loans.service';
import type { CreateLoanInput } from './loans.service';
import { Roles } from './roles.decorator';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @Roles('admin')
  async list(@Query('status') status?: LoanStatus) {
    return this.loansService.listByStatus(status);
  }

  @Post()
  @Roles('docente')
  async create(
    @Req() req: { user?: { id?: string } },
    @Body() body: Omit<CreateLoanInput, 'docenteId'>,
  ) {
    return this.loansService.createRequest({
      ...body,
      docenteId: String(req.user?.id ?? ''),
    }, { id: req.user?.id });
  }

  @Get('mine')
  @Roles('docente')
  async mine(
    @Req() req: { user?: { id?: string } },
    @Query('status') status?: LoanStatus,
  ) {
    return this.loansService.listMine(String(req.user?.id ?? ''), status);
  }

  @Patch(':id/approve')
  @Roles('admin')
  async approve(
    @Req() req: { user?: { id?: string; name?: string } },
    @Param('id') id: string,
  ) {
    return this.loansService.approve(id, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }

  @Patch(':id/reject')
  @Roles('admin')
  async reject(
    @Req() req: { user?: { id?: string; name?: string } },
    @Param('id') id: string,
    @Body() body: { note: string },
  ) {
    return this.loansService.reject(id, body?.note, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }

  @Patch(':id/deliver')
  @Roles('admin')
  async deliver(
    @Req() req: { user?: { id?: string; name?: string } },
    @Param('id') id: string,
  ) {
    return this.loansService.deliver(id, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }

  @Patch(':id/cancel')
  @Roles('admin')
  async cancelAsAdmin(
    @Req() req: { user?: { id?: string; name?: string } },
    @Param('id') id: string,
  ) {
    return this.loansService.cancelAsAdmin(id, {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }

  @Patch(':id/cancel-mine')
  @Roles('docente')
  async cancelAsTeacher(
    @Req() req: { user?: { id?: string } },
    @Param('id') id: string,
  ) {
    return this.loansService.cancelAsTeacher(String(req.user?.id ?? ''), id, {
      id: req.user?.id,
    });
  }

  @Patch(':id/return')
  @Roles('admin')
  async markReturned(
    @Req() req: { user?: { id?: string; name?: string } },
    @Param('id') id: string,
    @Body() body: { condition?: string; note?: string },
  ) {
    return this.loansService.markReturned(
      id,
      body,
      {
        id: req.user?.id,
        nombre: req.user?.name,
      },
    );
  }
}
