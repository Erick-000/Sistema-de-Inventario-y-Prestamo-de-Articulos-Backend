import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { ArticleCategoriesController } from './article-categories.controller';
import { ArticleCategoriesService } from './article-categories.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { Article, ArticleSchema } from './schemas/article.schema';
import { Loan, LoanSchema } from './schemas/loan.schema';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { User, UserSchema } from './schemas/user.schema';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomReservationsController } from './room-reservations.controller';
import { RoomReservationsService } from './room-reservations.service';
import { Room, RoomSchema } from './schemas/room.schema';
import {
  RoomReservation,
  RoomReservationSchema,
} from './schemas/room-reservation.schema';
import {
  RoomReservationBlock,
  RoomReservationBlockSchema,
} from './schemas/room-reservation-block.schema';
import {
  ArticleCategory,
  ArticleCategorySchema,
} from './schemas/article-category.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/inventario',
      {
        autoIndex: true,
      },
    ),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Article.name, schema: ArticleSchema },
      { name: Loan.name, schema: LoanSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Room.name, schema: RoomSchema },
      { name: RoomReservation.name, schema: RoomReservationSchema },
      { name: RoomReservationBlock.name, schema: RoomReservationBlockSchema },
      { name: ArticleCategory.name, schema: ArticleCategorySchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [
    AppController,
    AuthController,
    ArticlesController,
    LoansController,
    UsersController,
    NotificationsController,
    RoomsController,
    RoomReservationsController,
    ArticleCategoriesController,
    AuditController,
  ],
  providers: [
    AppService,
    ArticlesService,
    LoansService,
    UsersService,
    NotificationsService,
    AuthService,
    RoomsService,
    RoomReservationsService,
    ArticleCategoriesService,
    AuditService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
