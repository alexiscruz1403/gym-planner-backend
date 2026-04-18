import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { Follow, FollowSchema } from '../../schemas/follow.schema';
import {
  Notification,
  NotificationSchema,
} from '../../schemas/notification.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsCronService } from './notifications.cron';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
      { name: Follow.name, schema: FollowSchema },
    ]),
    // Local JwtModule registration so the gateway can verify tokens
    // without depending on AuthModule (avoids a circular import path).
    JwtModule.register({}),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationsListener,
    NotificationsCronService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
