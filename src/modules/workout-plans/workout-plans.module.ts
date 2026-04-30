import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WorkoutPlan,
  WorkoutPlanSchema,
} from '../../schemas/workout-plan.schema';
import { Exercise, ExerciseSchema } from '../../schemas/exercise.schema';
import {
  AiPlanProfile,
  AiPlanProfileSchema,
} from '../../schemas/ai-plan-profile.schema';
import { WorkoutPlansController } from './workout-plans.controller';
import { WorkoutPlansService } from './workout-plans.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkoutPlan.name, schema: WorkoutPlanSchema },
      { name: Exercise.name, schema: ExerciseSchema },
      { name: AiPlanProfile.name, schema: AiPlanProfileSchema },
    ]),
  ],
  controllers: [WorkoutPlansController],
  providers: [WorkoutPlansService],
  exports: [WorkoutPlansService],
})
export class WorkoutPlansModule {}
