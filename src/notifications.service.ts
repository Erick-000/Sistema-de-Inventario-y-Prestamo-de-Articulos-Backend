import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async list(userId?: string) {
    const filter =
      userId && Types.ObjectId.isValid(userId)
        ? { usuarioId: new Types.ObjectId(userId) }
        : { usuarioId: { $exists: false } };
    return this.notificationModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async markRead(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    return this.notificationModel
      .findByIdAndUpdate(id, { leida: true }, { new: true })
      .lean();
  }

  async markAllRead() {
    await this.notificationModel.updateMany(
      { leida: false },
      { $set: { leida: true } },
    );
    return { ok: true };
  }
}
