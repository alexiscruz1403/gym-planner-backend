import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  AiFitnessGoal,
  AiExperienceLevel,
  AiEquipment,
  AiPhysicalLimitation,
  AiPreference,
  AiSex,
} from '../common/enums';

export type AiPlanProfileDocument = HydratedDocument<AiPlanProfile>;

@Schema({ _id: false })
export class PhysicalProfile {
  @Prop({ required: true, min: 13, max: 100 })
  age: number;

  @Prop({ required: true, type: String, enum: Object.values(AiSex) })
  sex: AiSex;

  @Prop({ required: true, min: 100, max: 250 })
  heightCm: number;

  @Prop({ required: true, min: 30, max: 300 })
  currentWeightKg: number;

  @Prop({ required: false, min: 30, max: 300 })
  targetWeightKg?: number;

  @Prop({ required: false, min: 1, max: 60 })
  estimatedBodyFatPercent?: number;
}

export const PhysicalProfileSchema =
  SchemaFactory.createForClass(PhysicalProfile);

@Schema({ timestamps: true })
export class AiPlanProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WorkoutPlan', required: true })
  planId: Types.ObjectId;

  @Prop({ type: PhysicalProfileSchema, required: true })
  physicalProfile: PhysicalProfile;

  @Prop({ type: String, enum: Object.values(AiFitnessGoal), required: true })
  goal: AiFitnessGoal;

  @Prop({
    type: String,
    enum: Object.values(AiExperienceLevel),
    required: true,
  })
  experience: AiExperienceLevel;

  @Prop({ required: true, min: 1, max: 6 })
  daysPerWeek: number;

  @Prop({ required: true, min: 20, max: 180 })
  minutesPerSession: number;

  @Prop({ type: [String], enum: Object.values(AiEquipment), default: [] })
  equipment: AiEquipment[];

  @Prop({
    type: [String],
    enum: Object.values(AiPhysicalLimitation),
    default: [],
  })
  physicalLimitations: AiPhysicalLimitation[];

  @Prop({ type: [String], enum: Object.values(AiPreference), default: [] })
  preferences: AiPreference[];

  @Prop({ required: true })
  templateUsed: string;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const AiPlanProfileSchema = SchemaFactory.createForClass(AiPlanProfile);

AiPlanProfileSchema.index({ userId: 1, createdAt: -1 });
AiPlanProfileSchema.index({ planId: 1 });
