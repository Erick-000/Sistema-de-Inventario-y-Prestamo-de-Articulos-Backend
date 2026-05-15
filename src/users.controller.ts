import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from './roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('teachers')
  @Roles('admin')
  async listTeachers() {
    return this.usersService.findTeachers();
  }

  @Get()
  @Roles('admin')
  async listUsers() {
    return this.usersService.findManageableUsers();
  }

  @Get(':id/profile')
  @Roles('admin')
  async profile(@Param('id') id: string) {
    return this.usersService.profile(id);
  }

  @Patch(':id/block')
  @Roles('admin')
  async updateBlocked(
    @Req() req: { user?: { id?: string; name?: string } },
    @Param('id') id: string,
    @Body() body: { blocked?: boolean },
  ) {
    return this.usersService.updateBlocked(id, Boolean(body?.blocked), {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }

  @Patch(':id/password')
  @Roles('admin')
  async updateTeacherPassword(
    @Req() req: { user?: { id?: string; name?: string } },
    @Param('id') id: string,
    @Body() body: { password?: string },
  ) {
    return this.usersService.updateTeacherPassword(id, String(body?.password ?? ''), {
      id: req.user?.id,
      nombre: req.user?.name,
    });
  }
}
