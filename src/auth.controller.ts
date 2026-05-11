import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(body?.password ?? '');

    if (!email.endsWith('@miuniclaretiana.edu.co')) {
      throw new BadRequestException(
        'El correo debe ser @miuniclaretiana.edu.co',
      );
    }

    return this.authService.login(email, password);
  }

  @Get('me')
  async me(@Req() req: { user?: { id?: string } }) {
    if (!req.user?.id) throw new BadRequestException('Invalid user');
    return this.authService.me(req.user.id);
  }

  @Patch('cambiar-contrasena')
  async cambiarContrasena(
    @Req() req: { user?: { id?: string } },
    @Body() body: { actual: string; nueva: string },
  ) {
    if (!req.user?.id) throw new BadRequestException('Invalid user');
    return this.authService.cambiarContrasena(
      req.user.id,
      body.actual,
      body.nueva,
    );
  }
}
