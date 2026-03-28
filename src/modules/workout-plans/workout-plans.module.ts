import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WorkoutPlan,
  WorkoutPlanSchema,
} from '../../schemas/workout-plan.schema';
import { Exercise, ExerciseSchema } from '../../schemas/exercise.schema';
import { WorkoutPlansController } from './workout-plans.controller';
import { WorkoutPlansService } from './workout-plans.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkoutPlan.name, schema: WorkoutPlanSchema },
      // Needed to resolve exercise names when building plan days
      { name: Exercise.name, schema: ExerciseSchema },
    ]),
  ],
  controllers: [WorkoutPlansController],
  providers: [WorkoutPlansService],
})
export class WorkoutPlansModule {}
