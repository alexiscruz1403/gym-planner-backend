import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationType } from '../common/enums/notification-type.enum';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipientId: Types.ObjectId;

  // Null for SYSTEM notifications
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  actorId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(NotificationType),
    required: true,
  })
  type: NotificationType;

  // Generic payload — shape depends on type:
  // FOLLOW       → { actorUsername, actorAvatar }
  // POST_LIKE    → { actorUsername, actorAvatar, postId }
  // POST_COMMENT → { actorUsername, actorAvatar, postId, commentText }
  // NEW_POST     → { actorUsername, actorAvatar, postId }
  // SYSTEM       → { title, body }
  @Prop({ type: Object, required: true })
  data: Record<string, any>;

  @Prop({ required: true, default: false })
  isRead: boolean;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// List user notifications, newest first
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
// Unread count
NotificationSchema.index({ recipientId: 1, isRead: 1 });
// Daily cron purge
NotificationSchema.index({ createdAt: 1 });
