import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MuscleGroup } from '../common/enums/muscle-group.enum';
import { LoadType } from '../common/enums/load-type.enum';

export type ExerciseDocument = HydratedDocument<Exercise>;

@Schema({ timestamps: true })
export class Exercise {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: [String], enum: Object.values(MuscleGroup), required: true })
  musclesPrimary: MuscleGroup[];

  @Prop({ type: [String], enum: Object.values(MuscleGroup), default: [] })
  musclesSecondary: MuscleGroup[];

  @Prop({ type: String, enum: Object.values(LoadType), required: true })
  loadType: LoadType;

  @Prop({ default: true })
  bilateral: boolean;

  @Prop({ required: false })
  gifUrl?: string;

  @Prop({ required: false })
  videoUrl?: string;

  // Determines whether sets track repetitions or time duration.
  // 'reps' exercises log reps + weight; 'duration' exercises log durationSeconds only.
  @Prop({
    type: String,
    enum: ['reps', 'duration'],
    required: true,
    default: 'reps',
  })
  trackingType: 'reps' | 'duration';

  // Soft delete: admin deactivates, never hard-deletes
  // Preserves referential integrity with historical WorkoutSessions
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);

// Full-text search on name
ExerciseSchema.index({ name: 'text' });
// Compound index for frequent filter queries
ExerciseSchema.index({ musclesPrimary: 1, loadType: 1 });
