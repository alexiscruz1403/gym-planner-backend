import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../../schemas/workout-session.schema';
import {
  WorkoutPlan,
  WorkoutPlanSchema,
} from '../../schemas/workout-plan.schema';
import { Exercise, ExerciseSchema } from '../../schemas/exercise.schema';
import { WorkoutSessionsController } from './workout-sessions.controller';
import { WorkoutSessionsService } from './workout-sessions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      // Needed to read the active plan snapshot at session start.
      // WorkoutPlansModule is NOT imported — direct schema access only.
      { name: WorkoutPlan.name, schema: WorkoutPlanSchema },
      // Needed to resolve exercise name when replacing an exercise in session.
      { name: Exercise.name, schema: ExerciseSchema },
    ]),
  ],
  controllers: [WorkoutSessionsController],
  providers: [WorkoutSessionsService],
})
export class WorkoutSessionsModule {}
