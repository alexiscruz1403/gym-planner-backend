import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DayOfWeek } from '../common/enums/day-of-week.enum';
import { SessionStatus } from '../common/enums/session-status.enum';

export type WorkoutSessionDocument = HydratedDocument<WorkoutSession>;

// ─── SessionSet ───────────────────────────────────────────────────────────────
// Represents one logged set within a session exercise.
// setIndex is the source of truth for idempotent upserts on retries.

@Schema({ _id: false })
export class SessionSet {
  @Prop({ required: true, min: 0 })
  setIndex: number;

  // Exactly one of reps or duration must be present depending on exercise type
  @Prop({ required: false, min: 1 })
  reps?: number;

  @Prop({ required: false, min: 1 })
  duration?: number; // seconds — for timed exercises (plank, etc.)

  @Prop({ required: false, min: 0 })
  weight?: number; // kg — omitted for bodyweight exercises

  @Prop({ required: true, default: false })
  completed: boolean;

  @Prop({ required: true, default: () => new Date() })
  loggedAt: Date;
}

export const SessionSetSchema = SchemaFactory.createForClass(SessionSet);

// ─── SessionExercise ──────────────────────────────────────────────────────────
// Snapshot of one exercise's planned config plus logged sets.
// plannedX fields are mutable within the session (via modify-exercise endpoint)
// but never reflect back to WorkoutPlan.

@Schema({ _id: false })
export class SessionExercise {
  @Prop({ type: Types.ObjectId, ref: 'Exercise', required: true })
  exerciseId: Types.ObjectId;

  // Snapshot of exercise name at session start
  @Prop({ required: true })
  exerciseName: string;

  @Prop({ required: true, min: 0 })
  orderIndex: number;

  @Prop({ required: false })
  supersetGroupId?: string;

  @Prop({
    type: String,
    enum: ['reps', 'duration'],
    required: true,
    default: 'reps',
  })
  trackingType: 'reps' | 'duration';

  // Planned config — snapshotted from WorkoutPlan at session start.
  // Can be mutated via PATCH /sessions/:id/exercises/:exerciseId within the session.
  @Prop({ required: true, min: 1 })
  plannedSets: number;

  @Prop({ required: false, min: 1 })
  plannedReps?: number;

  @Prop({ required: false, min: 1 })
  plannedDuration?: number; // seconds

  @Prop({ required: false, min: 0 })
  plannedWeight?: number; // kg

  @Prop({ required: true, min: 0 })
  plannedRest: number; // seconds between sets

  // Grows as the user logs sets. Idempotent by setIndex.
  @Prop({ type: [SessionSetSchema], default: [] })
  sets: SessionSet[];

  // True if the user changed the planned config mid-session
  @Prop({ required: true, default: false })
  modifiedDuringSession: boolean;
}

export const SessionExerciseSchema =
  SchemaFactory.createForClass(SessionExercise);

// ─── WorkoutSession ───────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class WorkoutSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // Reference only — plan is never re-read after session creation
  @Prop({ type: Types.ObjectId, ref: 'WorkoutPlan', required: true })
  planId: Types.ObjectId;

  // Snapshot of plan name at session start
  @Prop({ required: true })
  planName: string;

  @Prop({ type: String, enum: Object.values(DayOfWeek), required: true })
  dayOfWeek: DayOfWeek;

  @Prop({
    type: String,
    enum: Object.values(SessionStatus),
    required: true,
    default: SessionStatus.IN_PROGRESS,
  })
  status: SessionStatus;

  @Prop({ required: true, default: () => new Date() })
  startedAt: Date;

  @Prop({ required: false })
  finishedAt?: Date;

  // Computed at finish: (finishedAt - startedAt) in seconds
  @Prop({ required: false })
  durationSeconds?: number;

  @Prop({ type: [SessionExerciseSchema], default: [] })
  exercises: SessionExercise[];

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const WorkoutSessionSchema =
  SchemaFactory.createForClass(WorkoutSession);

// Active session lookup — most frequent query
WorkoutSessionSchema.index({ userId: 1, status: 1 });
// Session history ordered by date
WorkoutSessionSchema.index({ userId: 1, startedAt: -1 });
// Last-performance resolution per exercise
WorkoutSessionSchema.index({
  userId: 1,
  'exercises.exerciseId': 1,
  startedAt: -1,
});
// Stats period queries (volume by period, volume by muscle) — matches userId + status range + startedAt range
WorkoutSessionSchema.index({ userId: 1, status: 1, startedAt: 1 });
