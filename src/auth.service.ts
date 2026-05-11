import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { User } from './schemas/user.schema';

export type AuthUser = {
  id: string;
  role: string;
  name: string;
  email: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
  debeCambiarContrasena: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  private getSecret() {
    return process.env.AUTH_SECRET ?? 'dev_secret_change_me';
  }

  private getTtlMs() {
    const raw = process.env.AUTH_TTL_MS;
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
    return 1000 * 60 * 60 * 8;
  }

  private sign(payloadJson: string) {
    return createHmac('sha256', this.getSecret())
      .update(payloadJson)
      .digest('base64url');
  }

  private hashPassword(plain: string) {
    const salt = randomBytes(16).toString('base64url');
    const derived = scryptSync(String(plain), salt, 32).toString('base64url');
    return `scrypt$${salt}$${derived}`;
  }

  private verifyPassword(plain: string, stored: string) {
    if (stored.startsWith('scrypt$')) {
      const parts = stored.split('$');
      const salt = parts[1];
      const expected = parts[2];
      if (!salt || !expected) return false;
      const derived = scryptSync(String(plain), salt, 32).toString('base64url');
      const a = Buffer.from(derived, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    }

    return stored === plain;
  }

  issueToken(payload: Record<string, unknown>) {
    const json = JSON.stringify(payload);
    const body = Buffer.from(json, 'utf8').toString('base64url');
    const sig = this.sign(body);
    return `${body}.${sig}`;
  }

  verifyToken(token: string): Record<string, unknown> {
    const [body, sig] = token.split('.');
    if (!body || !sig) throw new UnauthorizedException('Token inválido');

    const expected = this.sign(body);
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Token inválido');
    }

    const json = Buffer.from(body, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Record<string, unknown>;

    if (!parsed.sub || !parsed.role)
      throw new UnauthorizedException('Token inválido');

    if (typeof parsed.exp === 'number' && Number.isFinite(parsed.exp)) {
      if (Date.now() > parsed.exp) {
        throw new UnauthorizedException('Token expirado');
      }
    }
    return parsed;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const normalizedEmail = String(email ?? '')
      .trim()
      .toLowerCase();
    const user = await this.userModel
      .findOne({ correo: normalizedEmail })
      .lean();
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const u = user as unknown as {
      _id: unknown;
      rol: unknown;
      nombreCompleto: unknown;
      correo: unknown;
      bloqueado?: unknown;
      hashContrasena?: unknown;
      debeCambiarContrasena?: unknown;
    };

    if (u.bloqueado) {
      throw new UnauthorizedException('Usuario bloqueado');
    }

    const stored = typeof u.hashContrasena === 'string' ? u.hashContrasena : '';
    const ok = this.verifyPassword(String(password ?? ''), stored);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    if (!stored.startsWith('scrypt$')) {
      await this.userModel.updateOne(
        { _id: u._id },
        { $set: { hashContrasena: this.hashPassword(String(password ?? '')) } },
      );
    }

    const authUser: AuthUser = {
      id: String(u._id),
      role: String(u.rol),
      name: String(u.nombreCompleto),
      email: String(u.correo),
    };

    const now = Date.now();
    const exp = now + this.getTtlMs();

    const token = this.issueToken({
      sub: authUser.id,
      role: authUser.role,
      name: authUser.name,
      email: authUser.email,
      iat: now,
      exp,
    });

    return {
      token,
      user: authUser,
      debeCambiarContrasena: Boolean(u.debeCambiarContrasena),
    };
  }

  async me(id: string): Promise<{ user: AuthUser & { blocked?: boolean; debeCambiarContrasena?: boolean } }> {
    const user = await this.userModel.findById(id).lean();
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const u = user as unknown as {
      _id: unknown;
      rol: unknown;
      nombreCompleto: unknown;
      correo: unknown;
      bloqueado?: boolean;
      debeCambiarContrasena?: boolean;
    };

    return {
      user: {
        id: String(u._id),
        role: String(u.rol),
        name: String(u.nombreCompleto),
        email: String(u.correo),
        blocked: Boolean(u.bloqueado),
        debeCambiarContrasena: Boolean(u.debeCambiarContrasena),
      },
    };
  }

  async cambiarContrasena(
    userId: string,
    actual: string,
    nueva: string,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const ok = this.verifyPassword(actual, user.hashContrasena);
    if (!ok) throw new UnauthorizedException('Contrasena actual incorrecta');

    user.hashContrasena = this.hashPassword(nueva);
    user.debeCambiarContrasena = false;
    await user.save();

    return { ok: true };
  }
}
