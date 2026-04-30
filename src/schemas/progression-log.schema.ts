import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ProgressionChangeType } from '../common/enums';

export type ProgressionLogDocument = HydratedDocument<ProgressionLog>;

@Schema({ _id: false })
export class ExerciseChange {
  @Prop({ type: Types.ObjectId, ref: 'Exercise', required: true })
  exerciseId: Types.ObjectId;

  @Prop({ required: true })
  exerciseName: string;

  @Prop({
    type: String,
    enum: Object.values(ProgressionChangeType),
    required: true,
  })
  changeType: ProgressionChangeType;

  @Prop({ required: false })
  previousWeight?: number;

  @Prop({ required: false })
  newWeight?: number;

  @Prop({ required: false })
  previousLeftWeight?: number;

  @Prop({ required: false })
  newLeftWeight?: number;

  @Prop({ required: false })
  previousRightWeight?: number;

  @Prop({ required: false })
  newRightWeight?: number;

  @Prop({ required: false })
  previousSets?: number;

  @Prop({ required: false })
  newSets?: number;

  @Prop({ required: false })
  previousReps?: number;

  @Prop({ required: false })
  newReps?: number;

  @Prop({ required: true })
  reasoning: string;
}

export const ExerciseChangeSchema =
  SchemaFactory.createForClass(ExerciseChange);

@Schema({ timestamps: true })
export class ProgressionLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WorkoutPlan', required: true })
  planId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['weekly_cron', 'manual_trigger'],
    required: true,
  })
  source: 'weekly_cron' | 'manual_trigger';

  @Prop({ default: false })
  isDeloadWeek: boolean;

  @Prop({ type: [ExerciseChangeSchema], default: [] })
  changes: ExerciseChange[];

  // ISO week start (Monday midnight UTC) — used for deduplication
  @Prop({ required: true, type: Date })
  weekNumber: Date;

  @Prop({
    type: String,
    enum: ['pending', 'applied', 'rejected'],
    default: 'pending',
  })
  status: 'pending' | 'applied' | 'rejected';

  @Prop({ type: Date })
  appliedAt?: Date;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const ProgressionLogSchema =
  SchemaFactory.createForClass(ProgressionLog);

ProgressionLogSchema.index({ userId: 1, createdAt: -1 });
ProgressionLogSchema.index({ planId: 1, createdAt: -1 });
// Prevents double-processing the same week for a given user+plan
ProgressionLogSchema.index(
  { userId: 1, planId: 1, weekNumber: 1 },
  { unique: true },
);
