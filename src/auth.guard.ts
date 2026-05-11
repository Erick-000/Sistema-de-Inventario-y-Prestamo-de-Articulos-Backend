import {
  CanActivate,
  ExecutionContext,
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
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ headers?: Record<string, unknown>; user?: unknown }>();
    const authHeader = String(
      (req.headers?.authorization as string | undefined) ?? '',
    );

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Falta token');
    }

    const token = authHeader.slice(7).trim();
    if (!token) throw new UnauthorizedException('Falta token');

    const payload = this.authService.verifyToken(token);
    req.user = {
      id: String(payload.sub),
      role: String(payload.role),
      name: typeof payload.name === 'string' ? payload.name : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    } satisfies RequestUser;

    return true;
  }
}
