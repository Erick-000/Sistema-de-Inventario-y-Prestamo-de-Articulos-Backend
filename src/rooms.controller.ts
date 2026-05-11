import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from './roles.decorator';
import { RoomsService } from './rooms.service';
import type { CreateRoomInput, UpdateRoomInput } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async list() {
    return this.roomsService.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.roomsService.findById(id);
  }

  @Post()
  @Roles('admin')
  async create(@Body() body: CreateRoomInput) {
    return this.roomsService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() body: UpdateRoomInput) {
    return this.roomsService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  async deactivate(@Param('id') id: string) {
    return this.roomsService.deactivate(id);
  }
}
