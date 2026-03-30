import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../../schemas/workout-session.schema';
import { Exercise, ExerciseSchema } from '../../schemas/exercise.schema';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: Exercise.name, schema: ExerciseSchema },
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
