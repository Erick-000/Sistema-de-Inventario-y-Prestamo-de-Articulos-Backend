import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

export type RequestUser = {
  id: string;
  role: string;
  name?: string;
  email?: string;
  debeCambiarContrasena?: boolean;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ headers?: Record<string, unknown>; user?: unknown; url?: string }>();
    const authHeader = String(
      (req.headers?.authorization as string | undefined) ?? '',
    );

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Falta token');
    }

    const token = authHeader.slice(7).trim();
    if (!token) throw new UnauthorizedException('Falta token');

    const payload = this.authService.verifyToken(token);
    const sessionUser = await this.authService.validateSessionUser(String(payload.sub));
    const url = String(req.url ?? '');
    const canChangePassword =
      url.includes('/auth/cambiar-contrasena') || url.includes('/auth/me');
    if (sessionUser.debeCambiarContrasena && !canChangePassword) {
      throw new ForbiddenException('Debes cambiar la contraseña antes de continuar');
    }

    req.user = sessionUser satisfies RequestUser;

    return true;
  }
}
