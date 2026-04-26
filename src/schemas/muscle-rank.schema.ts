import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MuscleGroup } from '../common/enums/muscle-group.enum';

export type MuscleRankDocument = HydratedDocument<MuscleRank>;

@Schema({ timestamps: false })
export class MuscleRank {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(MuscleGroup), required: true })
  muscle: MuscleGroup;

  @Prop({ required: true, min: 1, max: 7, default: 1 })
  rank: number;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const MuscleRankSchema = SchemaFactory.createForClass(MuscleRank);

MuscleRankSchema.index({ userId: 1, muscle: 1 }, { unique: true });
MuscleRankSchema.index({ userId: 1 });
MuscleRankSchema.index({ muscle: 1, userId: 1, rank: -1 });
