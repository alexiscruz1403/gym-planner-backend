import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class ExerciseSide {
  @Prop({ required: false, min: 1 })
  reps?: number;

  @Prop({ required: false, min: 1 })
  duration?: number;

  @Prop({ required: false, min: 0 })
  weight?: number;
}

export const ExerciseSideSchema = SchemaFactory.createForClass(ExerciseSide);
