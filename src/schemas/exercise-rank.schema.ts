import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExerciseRankDocument = HydratedDocument<ExerciseRank>;

@Schema({ timestamps: false })
export class ExerciseRank {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Exercise', required: true })
  exerciseId: Types.ObjectId;

  @Prop({ required: true })
  exerciseName: string;

  @Prop({ required: true, min: 1, max: 7, default: 1 })
  rank: number;

  @Prop({ required: true, min: 0, default: 0 })
  bestValue: number;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const ExerciseRankSchema = SchemaFactory.createForClass(ExerciseRank);

ExerciseRankSchema.index({ userId: 1, exerciseId: 1 }, { unique: true });
ExerciseRankSchema.index({ userId: 1 });
