import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Query('userId') userId?: string) {
    return this.notificationsService.list(userId);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Patch('read-all')
  async markAllRead() {
    return this.notificationsService.markAllRead();
  }
}
