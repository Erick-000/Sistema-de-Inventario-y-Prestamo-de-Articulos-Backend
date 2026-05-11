import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes, scryptSync } from 'crypto';
import { User } from './schemas/user.schema';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async onModuleInit() {
    await this.seedUsers();
  }

  private hashPassword(plain: string) {
    const salt = randomBytes(16).toString('base64url');
    const derived = scryptSync(String(plain), salt, 32).toString('base64url');
    return `scrypt$${salt}$${derived}`;
  }

  private async seedUsers() {
    const now = new Date();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      const exists = await this.userModel.findOne({ correo: adminEmail });
      if (!exists) {
        try {
          await this.userModel.create({
            nombreCompleto: 'Administrador Sistema',
            tipoDocumento: 'CC',
            numeroDocumento: 'ADMIN-' + Date.now(),
            correo: adminEmail,
            hashContrasena: this.hashPassword(adminPassword),
            rol: 'admin',
            bloqueado: false,
            debeCambiarContrasena: true,
            createdAt: now,
            updatedAt: now,
          });
          console.log(`Admin creado: ${adminEmail}`);
        } catch (err) {
          console.error('Error al crear admin:', (err as Error).message);
        }
      }
    }

    const docenteEmail = process.env.DOCENTE_EMAIL;
    const docentePassword = process.env.DOCENTE_PASSWORD;

    if (docenteEmail && docentePassword) {
      const exists = await this.userModel.findOne({ correo: docenteEmail });
      if (!exists) {
        try {
          await this.userModel.create({
            nombreCompleto: 'Docente',
            tipoDocumento: 'CC',
            numeroDocumento: 'DOC-' + Date.now(),
            correo: docenteEmail,
            hashContrasena: this.hashPassword(docentePassword),
            rol: 'docente',
            programa: 'Facultad de Ingenieria',
            bloqueado: false,
            debeCambiarContrasena: true,
            createdAt: now,
            updatedAt: now,
          });
          console.log(`Docente creado: ${docenteEmail}`);
        } catch (err) {
          console.error('Error al crear docente:', (err as Error).message);
        }
      }
    }
  }
}
