import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ExerciseRank,
  ExerciseRankSchema,
} from '../../schemas/exercise-rank.schema';
import { MuscleRank, MuscleRankSchema } from '../../schemas/muscle-rank.schema';
import { Exercise, ExerciseSchema } from '../../schemas/exercise.schema';
import { Follow, FollowSchema } from '../../schemas/follow.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../../schemas/workout-session.schema';
import { RanksController } from './ranks.controller';
import { RanksService } from './ranks.service';
import { RanksListener } from './ranks.listener';
import { RanksCalculator } from './ranks.calculator';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExerciseRank.name, schema: ExerciseRankSchema },
      { name: MuscleRank.name, schema: MuscleRankSchema },
      { name: Exercise.name, schema: ExerciseSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: User.name, schema: UserSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
    ]),
  ],
  controllers: [RanksController],
  providers: [RanksService, RanksListener, RanksCalculator],
  exports: [RanksService],
})
export class RanksModule {}
