import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationPreferenceDocument =
  HydratedDocument<NotificationPreference>;

@Schema({ timestamps: true })
export class NotificationPreference {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ default: true })
  allowFollow: boolean;

  @Prop({ default: true })
  allowFollowRequest: boolean;

  @Prop({ default: true })
  allowPostLike: boolean;

  @Prop({ default: true })
  allowPostComment: boolean;

  @Prop({ default: true })
  allowNewPost: boolean;
}

export const NotificationPreferenceSchema = SchemaFactory.createForClass(
  NotificationPreference,
);
