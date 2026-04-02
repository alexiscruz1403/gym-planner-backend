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

// ─── SessionSummarySet ────────────────────────────────────────────────────────

@Schema({ _id: false })
export class SessionSummarySet {
  @Prop({ required: false })
  reps?: number;

  @Prop({ required: false })
  durationSeconds?: number;

  @Prop({ required: false })
  weightKg?: number;

  @Prop({ required: true, default: false })
  completed: boolean;
}

export const SessionSummarySetSchema =
  SchemaFactory.createForClass(SessionSummarySet);

// ─── SessionSummaryExercise ───────────────────────────────────────────────────

@Schema({ _id: false })
export class SessionSummaryExercise {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [SessionSummarySetSchema], default: [] })
  sets: SessionSummarySet[];
}

export const SessionSummaryExerciseSchema = SchemaFactory.createForClass(
  SessionSummaryExercise,
);

// ─── SessionSummary ───────────────────────────────────────────────────────────

@Schema({ _id: false })
export class SessionSummary {
  @Prop({ required: true, default: 0 })
  durationSeconds: number;

  @Prop({ required: true, default: 0 })
  totalSets: number;

  @Prop({ required: true, default: 0 })
  volumeKg: number;

  @Prop({ type: [SessionSummaryExerciseSchema], default: [] })
  exercises: SessionSummaryExercise[];
}

export const SessionSummarySchema =
  SchemaFactory.createForClass(SessionSummary);

// ─── Reply ────────────────────────────────────────────────────────────────────
// Level-2 nested comment. _id is enabled so replies can be addressed by ID.
// Replies cannot have their own replies (2-level cap enforced structurally).

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Reply {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, maxlength: 300, trim: true })
  text: string;

  @Prop({ type: Date })
  createdAt: Date;
}

export const ReplySchema = SchemaFactory.createForClass(Reply);

// ─── Comment ──────────────────────────────────────────────────────────────────
// _id enabled so comments can be targeted for replies.

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Comment {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, maxlength: 300, trim: true })
  text: string;

  @Prop({ type: [ReplySchema], default: [] })
  replies: Reply[];

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

  // Snapshotted from WorkoutSession at post creation time.
  // null on posts created before this field was introduced (pre-Sprint 7).
  @Prop({ type: SessionSummarySchema, required: false, default: null })
  sessionSummary: SessionSummary | null;

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
