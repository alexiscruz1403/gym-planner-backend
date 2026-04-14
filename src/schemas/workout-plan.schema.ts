import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DayOfWeek } from '../common/enums/day-of-week.enum';
import { WeightUnit } from '../common/enums/weight-unit.enum';

export type WorkoutPlanDocument = HydratedDocument<WorkoutPlan>;

// ─── ExerciseConfig ───────────────────────────────────────────────────────────
// Represents one exercise entry within a plan day.
// exerciseName is a snapshot taken at plan creation/update time to protect
// historical data if the exercise is renamed in the catalog later.

@Schema({ _id: true })
export class ExerciseConfig {
  @Prop({ type: Types.ObjectId, ref: 'Exercise', required: true })
  exerciseId: Types.ObjectId;

  // Snapshot of the exercise name at save time
  @Prop({ required: true })
  exerciseName: string;

  @Prop({ required: true, min: 1 })
  sets: number;

  // Exactly one of reps or duration must be present (validated at DTO level)
  @Prop({ required: false, min: 1 })
  reps?: number;

  @Prop({ required: false, min: 1 })
  duration?: number; // seconds — for timed exercises (plank, etc.)

  @Prop({ required: false, min: 0 })
  weight?: number; // kg — optional for bodyweight exercises

  @Prop({
    type: String,
    enum: Object.values(WeightUnit),
    required: true,
    default: WeightUnit.KG,
  })
  weightUnit: WeightUnit;

  @Prop({ required: true, min: 0 })
  rest: number; // seconds between sets

  @Prop({ required: false })
  notes?: string;

  // Superset: two exercises in the same day sharing this UUID are executed together
  @Prop({ required: false })
  supersetGroupId?: string;
}

export const ExerciseConfigSchema =
  SchemaFactory.createForClass(ExerciseConfig);

// ─── PlanDay ──────────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class PlanDay {
  @Prop({ type: String, enum: Object.values(DayOfWeek), required: true })
  dayOfWeek: DayOfWeek;

  // Optional custom label for the day (e.g., "Push", "Legs A")
  @Prop({ required: false, trim: true, maxlength: 100 })
  dayName?: string;

  @Prop({ type: [ExerciseConfigSchema], default: [] })
  exercises: ExerciseConfig[];
}

export const PlanDaySchema = SchemaFactory.createForClass(PlanDay);

// ─── WorkoutPlan ──────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class WorkoutPlan {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ type: [PlanDaySchema], default: [] })
  days: PlanDay[];

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const WorkoutPlanSchema = SchemaFactory.createForClass(WorkoutPlan);

// Frequent query: user's plans + active state
WorkoutPlanSchema.index({ userId: 1, isActive: 1 });
// Frequent query: user's plans ordered by creation date
WorkoutPlanSchema.index({ userId: 1, createdAt: -1 });
