import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FollowRequestDocument = HydratedDocument<FollowRequest>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class FollowRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipientId: Types.ObjectId;

  @Prop({ type: Date })
  createdAt: Date;
}

export const FollowRequestSchema = SchemaFactory.createForClass(FollowRequest);

// Prevents duplicate pending requests
FollowRequestSchema.index({ senderId: 1, recipientId: 1 }, { unique: true });
// Efficient retrieval of all incoming requests for a given user
FollowRequestSchema.index({ recipientId: 1, createdAt: -1 });
