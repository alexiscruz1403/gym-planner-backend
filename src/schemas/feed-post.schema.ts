import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FeedPostDocument = HydratedDocument<FeedPost>;

// ─── Reaction ─────────────────────────────────────────────────────────────────
// Single reaction type for MVP. Enum with one value keeps the door open
// for additional types without a schema migration.

@Schema({ _id: false })
export class Reaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['like'], required: true, default: 'like' })
  type: 'like';
}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);

// ─── Comment ──────────────────────────────────────────────────────────────────

@Schema({ _id: false, timestamps: { createdAt: true, updatedAt: false } })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, maxlength: 300, trim: true })
  text: string;

  @Prop({ type: Date })
  createdAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// ─── FeedPost ─────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class FeedPost {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WorkoutSession', required: true })
  sessionId: Types.ObjectId;

  @Prop({ required: false })
  photoUrl?: string;

  @Prop({ required: false, maxlength: 500, trim: true })
  caption?: string;

  @Prop({ type: [ReactionSchema], default: [] })
  reactions: Reaction[];

  @Prop({ type: [CommentSchema], default: [] })
  comments: Comment[];

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const FeedPostSchema = SchemaFactory.createForClass(FeedPost);

// Feed query: posts by a specific user ordered by date
FeedPostSchema.index({ userId: 1, createdAt: -1 });
// Global feed query: posts filtered by a set of userIds ordered by date
FeedPostSchema.index({ createdAt: -1 });
