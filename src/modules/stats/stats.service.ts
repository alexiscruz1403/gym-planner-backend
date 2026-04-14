import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  WorkoutSession,
  WorkoutSessionDocument,
} from '../../schemas/workout-session.schema';
import { Exercise, ExerciseDocument } from '../../schemas/exercise.schema';
import { SessionStatus } from '../../common/enums/session-status.enum';
import { ExerciseHistoryQueryDto } from './dto/exercise-history-query.dto';
import { StatsQueryDto } from './dto/stats-query.dto';

const STATS_CACHE_TTL = 300; // 5 minutes in seconds

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(WorkoutSession.name)
    private readonly sessionModel: Model<WorkoutSessionDocument>,
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ─── Exercise History ─────────────────────────────────────────────────────────

  async getExerciseHistory(
    userId: string,
    exerciseId: string,
    query: ExerciseHistoryQueryDto,
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const key = `stats:exercise-history:${userId}:${exerciseId}:${page}:${limit}`;
    const cached = await this.cacheManager.get(key);
    if (cached) return cached;

    const result = await this._getExerciseHistory(userId, exerciseId, query);
    await this.cacheManager.set(key, result, STATS_CACHE_TTL);
    return result;
  }

  private async _getExerciseHistory(
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
      weightUnit?: string;
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
        weightUnit: exercise?.weightUnit,
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
    userId: string,
    query: StatsQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const key = `stats:volume:${userId}:${query.period}:${query.date}`;
    const cached = await this.cacheManager.get(key);
    if (cached) return cached;

    const result = await this._getVolumeByPeriod(userId, query);
    await this.cacheManager.set(key, result, STATS_CACHE_TTL);
    return result;
  }

  private async _getVolumeByPeriod(
    userId: string,
    query: StatsQueryDto,
  ): Promise<{
    period: string;
    date: string;
    from: Date;
    to: Date;
    totalVolume: number;
    totalSets: number;
    totalSessions: number;
    breakdown: {
      label: string;
      volume: number;
      sets: number;
      sessions: number;
    }[];
  }> {
    const { from, to } = this.parseDateRange(query.period, query.date);

    const labelExpression = this.buildLabelExpression(query.period);

    // Pipeline: unwind exercises → unwind sets → filter completed sets with weight
    // → group by label to produce the per-sub-period breakdown
    const breakdownPipeline = [
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
          startedAt: { $gte: from, $lte: to },
        },
      },
      { $unwind: '$exercises' },
      { $unwind: '$exercises.sets' },
      {
        $match: {
          'exercises.sets.completed': true,
          'exercises.sets.weight': { $ne: null },
          'exercises.sets.reps': { $ne: null },
        },
      },
      {
        $group: {
          _id: labelExpression,
          volume: {
            $sum: {
              $multiply: ['$exercises.sets.reps', '$exercises.sets.weight'],
            },
          },
          sets: { $sum: 1 },
          // Track distinct session IDs to compute sessions-per-label
          sessionIds: { $addToSet: '$_id' },
        },
      },
      { $sort: { _id: 1 as const } },
    ];

    // Pipeline: session-level count (no unwind needed)
    const sessionsPipeline = [
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
          startedAt: { $gte: from, $lte: to },
        },
      },
      { $count: 'total' },
    ];

    const [breakdownRaw, sessionsRaw] = await Promise.all([
      this.sessionModel.aggregate(breakdownPipeline).exec(),
      this.sessionModel.aggregate(sessionsPipeline).exec(),
    ]);

    const totalSessions: number =
      sessionsRaw.length > 0 ? (sessionsRaw[0].total as number) : 0;

    const breakdown = (
      breakdownRaw as {
        _id: string;
        volume: number;
        sets: number;
        sessionIds: unknown[];
      }[]
    ).map((item) => ({
      label: item._id,
      volume: item.volume,
      sets: item.sets,
      sessions: item.sessionIds.length,
    }));

    const totalVolume = breakdown.reduce((acc, b) => acc + b.volume, 0);
    const totalSets = breakdown.reduce((acc, b) => acc + b.sets, 0);

    return {
      period: query.period,
      date: query.date,
      from,
      to,
      totalVolume,
      totalSets,
      totalSessions,
      breakdown,
    };
  }

  // ─── Volume by Muscle ─────────────────────────────────────────────────────────

  async getVolumeByMuscle(
    userId: string,
    query: StatsQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const key = `stats:muscles:${userId}:${query.period}:${query.date}`;
    const cached = await this.cacheManager.get(key);
    if (cached) return cached;

    const result = await this._getVolumeByMuscle(userId, query);
    await this.cacheManager.set(key, result, STATS_CACHE_TTL);
    return result;
  }

  private async _getVolumeByMuscle(
    userId: string,
    query: StatsQueryDto,
  ): Promise<{
    period: string;
    date: string;
    from: Date;
    to: Date;
    ranking: { rank: number; muscle: string; volume: number; sets: number }[];
  }> {
    const { from, to } = this.parseDateRange(query.period, query.date);

    // Pipeline:
    // 1. Match sessions in the period
    // 2. Unwind exercises
    // 3. $lookup to join Exercise catalog by exerciseId → get musclesPrimary
    // 4. Unwind catalog result and musclesPrimary
    // 5. Unwind sets, filter completed sets with weight
    // 6. Group by primary muscle, summing volume and sets
    // 7. Sort by volume descending
    const pipeline = [
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
          startedAt: { $gte: from, $lte: to },
        },
      },
      { $unwind: '$exercises' },
      {
        $lookup: {
          from: 'exercises',
          localField: 'exercises.exerciseId',
          foreignField: '_id',
          as: 'catalogExercise',
        },
      },
      // Exercises not found in catalog (edge case) are silently dropped here
      { $unwind: '$catalogExercise' },
      { $unwind: '$catalogExercise.musclesPrimary' },
      { $unwind: '$exercises.sets' },
      {
        $match: {
          'exercises.sets.completed': true,
          'exercises.sets.weight': { $ne: null },
          'exercises.sets.reps': { $ne: null },
        },
      },
      {
        $group: {
          _id: '$catalogExercise.musclesPrimary',
          volume: {
            $sum: {
              $multiply: ['$exercises.sets.reps', '$exercises.sets.weight'],
            },
          },
          sets: { $sum: 1 },
        },
      },
      { $sort: { volume: -1 as const } },
    ];

    const raw = (await this.sessionModel.aggregate(pipeline).exec()) as {
      _id: string;
      volume: number;
      sets: number;
    }[];

    const ranking = raw.map((item, index) => ({
      rank: index + 1,
      muscle: item._id,
      volume: item.volume,
      sets: item.sets,
    }));

    return {
      period: query.period,
      date: query.date,
      from,
      to,
      ranking,
    };
  }

  // ─── Date Range Helper ────────────────────────────────────────────────────────

  private parseDateRange(
    period: string,
    date: string,
  ): { from: Date; to: Date } {
    if (period === 'month') {
      // Expected format: YYYY-MM
      const match = /^(\d{4})-(\d{2})$/.exec(date);
      if (!match) {
        throw new BadRequestException(
          'Invalid date format for period "month". Expected YYYY-MM (e.g. 2026-03)',
        );
      }
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // zero-based
      const from = new Date(year, month, 1, 0, 0, 0, 0);
      const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { from, to };
    }

    if (period === 'year') {
      // Expected format: YYYY
      const match = /^(\d{4})$/.exec(date);
      if (!match) {
        throw new BadRequestException(
          'Invalid date format for period "year". Expected YYYY (e.g. 2026)',
        );
      }
      const year = parseInt(match[1], 10);
      const from = new Date(year, 0, 1, 0, 0, 0, 0);
      const to = new Date(year, 11, 31, 23, 59, 59, 999);
      return { from, to };
    }

    if (period === 'week') {
      // Expected format: YYYY-Www  (e.g. 2026-W13)
      const match = /^(\d{4})-W(\d{2})$/.exec(date);
      if (!match) {
        throw new BadRequestException(
          'Invalid date format for period "week". Expected YYYY-Www (e.g. 2026-W13)',
        );
      }
      const year = parseInt(match[1], 10);
      const week = parseInt(match[2], 10);

      // ISO week 1 is the week containing the first Thursday of the year.
      // Monday of ISO week W = Jan 4 + (W - 1) * 7 days, adjusted to Monday.
      const jan4 = new Date(year, 0, 4);
      const dayOfWeekJan4 = jan4.getDay() === 0 ? 7 : jan4.getDay(); // Mon=1..Sun=7
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - (dayOfWeekJan4 - 1) + (week - 1) * 7);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      return { from: monday, to: sunday };
    }

    throw new BadRequestException(`Unknown period: ${period}`);
  }

  // Builds the MongoDB $group _id expression that produces the breakdown label
  // per period.
  private buildLabelExpression(period: string): Record<string, unknown> {
    if (period === 'week') {
      // Daily label: YYYY-MM-DD
      return { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } };
    }

    if (period === 'month') {
      // Weekly label: YYYY-Www  (ISO week)
      // MongoDB $isoWeek returns 1-53, $isoWeekYear returns the ISO year
      return {
        $concat: [
          { $toString: { $isoWeekYear: '$startedAt' } },
          '-W',
          {
            $cond: {
              if: { $lt: [{ $isoWeek: '$startedAt' }, 10] },
              then: {
                $concat: ['0', { $toString: { $isoWeek: '$startedAt' } }],
              },
              else: { $toString: { $isoWeek: '$startedAt' } },
            },
          },
        ],
      };
    }

    // year → monthly label: YYYY-MM
    return { $dateToString: { format: '%Y-%m', date: '$startedAt' } };
  }
}
