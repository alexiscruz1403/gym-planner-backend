import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AiPlanProfile,
  AiPlanProfileSchema,
} from '../../schemas/ai-plan-profile.schema';
import {
  ProgressionLog,
  ProgressionLogSchema,
} from '../../schemas/progression-log.schema';
import {
  WorkoutPlan,
  WorkoutPlanSchema,
} from '../../schemas/workout-plan.schema';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../../schemas/workout-session.schema';
import { Exercise, ExerciseSchema } from '../../schemas/exercise.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { WorkoutPlansModule } from '../workout-plans/workout-plans.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProgressionService } from './ai-progression.service';
import { AiCronService } from './ai-cron.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: AiPlanProfile.name, schema: AiPlanProfileSchema },
      { name: ProgressionLog.name, schema: ProgressionLogSchema },
      { name: WorkoutPlan.name, schema: WorkoutPlanSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: Exercise.name, schema: ExerciseSchema },
      { name: User.name, schema: UserSchema },
    ]),
    WorkoutPlansModule,
  ],
  controllers: [AiController],
  providers: [AiService, AiProgressionService, AiCronService],
})
export class AiModule {}
