import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Roles } from './roles.decorator';
import { RoomReservationsService } from './room-reservations.service';
import type {
  CreateRoomBlockInput,
  CreateRoomReservationInput,
} from './room-reservations.service';

type AuthedReq = {
  user?: {
    id?: string;
    role?: string;
  };
};

@Controller('room-reservations')
export class RoomReservationsController {
  constructor(private readonly service: RoomReservationsService) {}

  @Get()
  @Roles('admin')
  async listAll() {
    return this.service.listAll();
  }

  @Get('mine')
  @Roles('docente')
  async listMine(@Req() req: AuthedReq) {
    const docenteId = String(req.user?.id ?? '');
    return this.service.listMine(docenteId);
  }

  @Get('availability')
  @Roles('admin', 'docente')
  async availability(
    @Query('salonId') salonId: string,
    @Query('fecha') fecha: string,
  ) {
    return this.service.listAvailability(salonId, fecha);
  }

  @Get('week')
  @Roles('admin', 'docente')
  async week(@Query('start') start: string) {
    return this.service.listWeek(start);
  }

  @Post()
  @Roles('docente')
  async create(
    @Req() req: AuthedReq,
    @Body() body: CreateRoomReservationInput,
  ) {
    const docenteId = String(req.user?.id ?? '');
    return this.service.create(docenteId, body, {
      id: req.user?.id,
    });
  }

  @Post('blocks')
  @Roles('admin')
  async createBlock(@Req() req: AuthedReq, @Body() body: CreateRoomBlockInput) {
    return this.service.createBlock(body, {
      id: req.user?.id,
    });
  }

  @Patch(':id/cancel')
  @Roles('admin')
  async cancelAsAdmin(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.service.cancelAsAdmin(id, {
      id: req.user?.id,
    });
  }

  @Patch(':id/cancel-mine')
  @Roles('docente')
  async cancelMine(@Req() req: AuthedReq, @Param('id') id: string) {
    const docenteId = String(req.user?.id ?? '');
    return this.service.cancelAsTeacher(docenteId, id, {
      id: req.user?.id,
    });
  }

  @Patch(':id/approve')
  @Roles('admin')
  async approve(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.service.approve(id, {
      id: req.user?.id,
    });
  }

  @Patch(':id/reject')
  @Roles('admin')
  async reject(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { motivo?: string },
  ) {
    return this.service.reject(id, body?.motivo, {
      id: req.user?.id,
    });
  }
}
