import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FollowDocument = HydratedDocument<Follow>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Follow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  followerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  followingId: Types.ObjectId;

  @Prop({ type: Date })
  createdAt: Date;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);

// Prevents duplicate follows and enables O(1) follow-state lookups
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// Efficient retrieval of all followers for a given user
FollowSchema.index({ followingId: 1, createdAt: -1 });
// Efficient retrieval of all users a given user is following
FollowSchema.index({ followerId: 1, createdAt: -1 });
