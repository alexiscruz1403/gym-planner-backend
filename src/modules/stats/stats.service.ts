import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WorkoutSession,
  WorkoutSessionDocument,
} from '../../schemas/workout-session.schema';
import { Exercise, ExerciseDocument } from '../../schemas/exercise.schema';
import { SessionStatus } from '../../common/enums/session-status.enum';
import { ExerciseHistoryQueryDto } from './dto/exercise-history-query.dto';
import { StatsQueryDto } from './dto/stats-query.dto';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(WorkoutSession.name)
    private readonly sessionModel: Model<WorkoutSessionDocument>,
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
  ) {}

  // ─── Exercise History ─────────────────────────────────────────────────────────

  async getExerciseHistory(
    userId: string,
    exerciseId: string,
    query: ExerciseHistoryQueryDto,
  ): Promise<{
    exerciseId: string;
    exerciseName: string;
    data: {
      sessionId: string;
      sessionDate: Date;
      dayOfWeek: string;
      sets: {
        setIndex: number;
        reps?: number;
        weight?: number;
        duration?: number;
        completed: boolean;
        loggedAt: Date;
      }[];
    }[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    let exerciseObjectId: Types.ObjectId;
    try {
      exerciseObjectId = new Types.ObjectId(exerciseId);
    } catch {
      throw new BadRequestException('Invalid exerciseId format');
    }

    const filter = {
      userId: new Types.ObjectId(userId),
      status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
      'exercises.exerciseId': exerciseObjectId,
    };

    const [sessions, total] = await Promise.all([
      this.sessionModel
        .find(filter)
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.sessionModel.countDocuments(filter).exec(),
    ]);

    // Derive exerciseName from the most recent session that contains this exercise
    let exerciseName = '';
    if (sessions.length > 0) {
      const match = sessions[0].exercises.find(
        (e) => e.exerciseId.toString() === exerciseId,
      );
      if (match) exerciseName = match.exerciseName;
    }

    const data = sessions.map((session) => {
      const exercise = session.exercises.find(
        (e) => e.exerciseId.toString() === exerciseId,
      );

      return {
        sessionId: session._id.toString(),
        sessionDate: session.startedAt,
        dayOfWeek: session.dayOfWeek,
        sets: exercise
          ? exercise.sets.map((s) => ({
              setIndex: s.setIndex,
              reps: s.reps,
              weight: s.weight,
              duration: s.duration,
              completed: s.completed,
              loggedAt: s.loggedAt,
            }))
          : [],
      };
    });

    return {
      exerciseId,
      exerciseName,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Volume by Period ─────────────────────────────────────────────────────────

  async getVolumeByPeriod(
    _userId: string,
    _query: StatsQueryDto,
  ): Promise<unknown> {
    // Implemented in Phase 3
    throw new Error('Not implemented');
  }

  // ─── Volume by Muscle ─────────────────────────────────────────────────────────

  async getVolumeByMuscle(
    _userId: string,
    _query: StatsQueryDto,
  ): Promise<unknown> {
    // Implemented in Phase 4
    throw new Error('Not implemented');
  }

  // ─── Date Range Helper ────────────────────────────────────────────────────────
  // Implemented in Phase 3 alongside getVolumeByPeriod
}
