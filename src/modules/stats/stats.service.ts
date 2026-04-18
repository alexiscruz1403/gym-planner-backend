import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
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
    bilateral: boolean;
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
        left?: { reps?: number; duration?: number; weight?: number } | null;
        right?: { reps?: number; duration?: number; weight?: number } | null;
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

    // Derive exerciseName + bilateral from the most recent session that contains this exercise
    let exerciseName = '';
    let bilateral = true;
    if (sessions.length > 0) {
      const match = sessions[0].exercises.find(
        (e) => e.exerciseId.toString() === exerciseId,
      );
      if (match) {
        exerciseName = match.exerciseName;
        bilateral = match.bilateral ?? true;
      }
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
              left: s.left ?? null,
              right: s.right ?? null,
              completed: s.completed,
              loggedAt: s.loggedAt,
            }))
          : [],
      };
    });

    return {
      exerciseId,
      exerciseName,
      bilateral,
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
    hasLbsExercises: boolean;
    breakdown: {
      label: string;
      volume: number;
      sets: number;
      sessions: number;
    }[];
    previousTotalVolume: number;
    changePercent: number | null;
  }> {
    const { from, to } = this.parseDateRange(query.period, query.date);

    const labelExpression = this.buildLabelExpression(query.period);
    const perSetVolume = this.perSetVolumeExpr();

    // Pipeline: unwind exercises → unwind sets → filter completed sets that carry
    // either bilateral (singular reps+weight) or unilateral (left/right) data
    // → group by label to produce the per-sub-period breakdown.
    // Weight is normalized to kg: lbs values are divided by 2.20462.
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
          $or: [
            {
              'exercises.sets.weight': { $ne: null },
              'exercises.sets.reps': { $ne: null },
            },
            {
              'exercises.sets.left.weight': { $ne: null },
              'exercises.sets.left.reps': { $ne: null },
            },
            {
              'exercises.sets.right.weight': { $ne: null },
              'exercises.sets.right.reps': { $ne: null },
            },
          ],
        },
      },
      {
        $group: {
          _id: labelExpression,
          volume: { $sum: perSetVolume },
          sets: { $sum: 1 },
          // Track distinct session IDs to compute sessions-per-label
          sessionIds: { $addToSet: '$_id' },
          // Track if any exercise used lbs
          units: { $addToSet: '$exercises.weightUnit' },
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

    // Previous period — same aggregation but for the preceding range
    const { from: prevFrom, to: prevTo } = this.getPreviousDateRange(
      query.period,
      query.date,
    );

    const prevVolumePipeline = [
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
          startedAt: { $gte: prevFrom, $lte: prevTo },
        },
      },
      { $unwind: '$exercises' },
      { $unwind: '$exercises.sets' },
      {
        $match: {
          'exercises.sets.completed': true,
          $or: [
            {
              'exercises.sets.weight': { $ne: null },
              'exercises.sets.reps': { $ne: null },
            },
            {
              'exercises.sets.left.weight': { $ne: null },
              'exercises.sets.left.reps': { $ne: null },
            },
            {
              'exercises.sets.right.weight': { $ne: null },
              'exercises.sets.right.reps': { $ne: null },
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          volume: { $sum: perSetVolume },
        },
      },
    ];

    const [breakdownRaw, sessionsRaw, prevVolumeRaw] = await Promise.all([
      this.sessionModel.aggregate(breakdownPipeline).exec(),
      this.sessionModel.aggregate(sessionsPipeline).exec(),
      this.sessionModel.aggregate(prevVolumePipeline).exec(),
    ]);

    const totalSessions: number =
      sessionsRaw.length > 0 ? (sessionsRaw[0].total as number) : 0;

    // Collect all units across all breakdown buckets
    const allUnits = new Set<string>();

    const breakdown = (
      breakdownRaw as {
        _id: string;
        volume: number;
        sets: number;
        sessionIds: unknown[];
        units: string[];
      }[]
    ).map((item) => {
      item.units.forEach((u) => allUnits.add(u));
      return {
        label: item._id,
        volume: Math.round(item.volume * 100) / 100,
        sets: item.sets,
        sessions: item.sessionIds.length,
      };
    });

    const totalVolume =
      Math.round(breakdown.reduce((acc, b) => acc + b.volume, 0) * 100) / 100;
    const totalSets = breakdown.reduce((acc, b) => acc + b.sets, 0);

    const previousTotalVolume =
      prevVolumeRaw.length > 0
        ? Math.round((prevVolumeRaw[0] as { volume: number }).volume * 100) /
          100
        : 0;

    const changePercent =
      previousTotalVolume === 0
        ? null
        : Math.round(
            ((totalVolume - previousTotalVolume) / previousTotalVolume) *
              100 *
              100,
          ) / 100;

    return {
      period: query.period,
      date: query.date,
      from,
      to,
      totalVolume,
      totalSets,
      totalSessions,
      hasLbsExercises: allUnits.has('lbs'),
      breakdown,
      previousTotalVolume,
      changePercent,
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
    hasLbsExercises: boolean;
    ranking: {
      rank: number;
      muscle: string;
      volume: number;
      sets: number;
      previousVolume: number;
      changePercent: number | null;
    }[];
  }> {
    const { from, to } = this.parseDateRange(query.period, query.date);
    const { from: prevFrom, to: prevTo } = this.getPreviousDateRange(
      query.period,
      query.date,
    );

    const perSetVolume = this.perSetVolumeExpr();

    // Pipeline builder for muscle volume — reused for current and previous period.
    // Weight is normalized to kg: lbs values are divided by 2.20462.
    // Unilateral sets contribute (left.reps × left.weight) + (right.reps × right.weight).
    const buildMusclePipeline = (
      rangeFrom: Date,
      rangeTo: Date,
    ): PipelineStage[] => [
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
          startedAt: { $gte: rangeFrom, $lte: rangeTo },
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
          $or: [
            {
              'exercises.sets.weight': { $ne: null },
              'exercises.sets.reps': { $ne: null },
            },
            {
              'exercises.sets.left.weight': { $ne: null },
              'exercises.sets.left.reps': { $ne: null },
            },
            {
              'exercises.sets.right.weight': { $ne: null },
              'exercises.sets.right.reps': { $ne: null },
            },
          ],
        },
      },
      {
        $group: {
          _id: '$catalogExercise.musclesPrimary',
          volume: { $sum: perSetVolume },
          sets: { $sum: 1 },
          units: { $addToSet: '$exercises.weightUnit' },
        },
      },
      { $sort: { volume: -1 as const } },
    ];

    const [currentRaw, previousRaw] = await Promise.all([
      this.sessionModel
        .aggregate(buildMusclePipeline(from, to))
        .exec() as Promise<
        { _id: string; volume: number; sets: number; units: string[] }[]
      >,
      this.sessionModel
        .aggregate(buildMusclePipeline(prevFrom, prevTo))
        .exec() as Promise<
        { _id: string; volume: number; sets: number; units: string[] }[]
      >,
    ]);

    // Build a lookup map for previous period volumes per muscle
    const prevVolumeMap = new Map<string, number>();
    for (const item of previousRaw) {
      prevVolumeMap.set(item._id, Math.round(item.volume * 100) / 100);
    }

    const allUnits = new Set<string>();

    const ranking = currentRaw.map((item, index) => {
      item.units.forEach((u) => allUnits.add(u));
      const volume = Math.round(item.volume * 100) / 100;
      const previousVolume = prevVolumeMap.get(item._id) ?? 0;
      const changePercent =
        previousVolume === 0
          ? null
          : Math.round(
              ((volume - previousVolume) / previousVolume) * 100 * 100,
            ) / 100;

      return {
        rank: index + 1,
        muscle: item._id,
        volume,
        sets: item.sets,
        previousVolume,
        changePercent,
      };
    });

    return {
      period: query.period,
      date: query.date,
      from,
      to,
      hasLbsExercises: allUnits.has('lbs'),
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

  // Returns the date range for the period immediately before the given one.
  // Used to compute volume change percentages.
  private getPreviousDateRange(
    period: string,
    date: string,
  ): { from: Date; to: Date } {
    if (period === 'month') {
      const match = /^(\d{4})-(\d{2})$/.exec(date)!;
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      // Previous month
      const prevDate = new Date(year, month - 1, 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth();
      const prevDateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
      return this.parseDateRange('month', prevDateStr);
    }

    if (period === 'year') {
      const match = /^(\d{4})$/.exec(date)!;
      const prevYear = parseInt(match[1], 10) - 1;
      return this.parseDateRange('year', `${prevYear}`);
    }

    // week — parse current week, subtract 7 days from monday, derive ISO week
    const match = /^(\d{4})-W(\d{2})$/.exec(date)!;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    // Compute monday of the current ISO week
    const jan4 = new Date(year, 0, 4);
    const dayOfWeekJan4 = jan4.getDay() === 0 ? 7 : jan4.getDay();
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (dayOfWeekJan4 - 1) + (week - 1) * 7);

    // Previous week's monday
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);

    // Derive ISO year and week number for previous monday
    const prevThursday = new Date(prevMonday);
    prevThursday.setDate(prevMonday.getDate() + 3);
    const isoYear = prevThursday.getFullYear();
    const jan4Prev = new Date(isoYear, 0, 4);
    const dayOfWeekJan4Prev = jan4Prev.getDay() === 0 ? 7 : jan4Prev.getDay();
    const mondayWeek1Prev = new Date(jan4Prev);
    mondayWeek1Prev.setDate(jan4Prev.getDate() - (dayOfWeekJan4Prev - 1));
    const isoWeek =
      Math.round(
        (prevMonday.getTime() - mondayWeek1Prev.getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      ) + 1;

    const prevDateStr = `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
    return this.parseDateRange('week', prevDateStr);
  }

  // Builds a MongoDB expression that normalizes a weight field to kg.
  // If exercises.weightUnit === 'lbs', divides the value by 2.20462.
  // Old documents without weightUnit are treated as kg.
  // The weightField path lets us reuse this for sets.weight, sets.left.weight, sets.right.weight.
  private normalizedWeightExpr(weightField: string): Record<string, unknown> {
    return {
      $cond: {
        if: { $eq: ['$exercises.weightUnit', 'lbs'] },
        then: { $divide: [weightField, 2.20462] },
        else: weightField,
      },
    };
  }

  // Per-set volume expression that handles both bilateral and unilateral sets.
  // Bilateral: reps × weight (singular fields).
  // Unilateral: (left.reps × left.weight) + (right.reps × right.weight).
  // Missing values contribute 0 via $ifNull, so each set populates exactly one path.
  private perSetVolumeExpr(): Record<string, unknown> {
    return {
      $add: [
        {
          $multiply: [
            { $ifNull: ['$exercises.sets.reps', 0] },
            this.normalizedWeightExpr({
              $ifNull: ['$exercises.sets.weight', 0],
            } as unknown as string),
          ],
        },
        {
          $multiply: [
            { $ifNull: ['$exercises.sets.left.reps', 0] },
            this.normalizedWeightExpr({
              $ifNull: ['$exercises.sets.left.weight', 0],
            } as unknown as string),
          ],
        },
        {
          $multiply: [
            { $ifNull: ['$exercises.sets.right.reps', 0] },
            this.normalizedWeightExpr({
              $ifNull: ['$exercises.sets.right.weight', 0],
            } as unknown as string),
          ],
        },
      ],
    };
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
