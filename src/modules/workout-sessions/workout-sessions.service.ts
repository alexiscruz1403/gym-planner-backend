import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  WorkoutSession,
  WorkoutSessionDocument,
  SessionExercise,
  SessionSet,
} from '../../schemas/workout-session.schema';
import {
  WorkoutPlan,
  WorkoutPlanDocument,
} from '../../schemas/workout-plan.schema';
import { Exercise, ExerciseDocument } from '../../schemas/exercise.schema';
import { SessionStatus } from '../../common/enums/session-status.enum';
import { StartSessionDto } from './dto/start-session.dto';
import { LogSetDto } from './dto/log-set.dto';
import { ReplaceExerciseDto } from './dto/replace-exercise.dto';
import { FinishSessionDto } from './dto/finish-session.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { PublicSessionHistoryQueryDto } from './dto/public-session-history-query.dto';

const SESSIONS_CACHE_TTL = 120; // 2 minutes in seconds

@Injectable()
export class WorkoutSessionsService {
  constructor(
    @InjectModel(WorkoutSession.name)
    private readonly sessionModel: Model<WorkoutSessionDocument>,
    @InjectModel(WorkoutPlan.name)
    private readonly workoutPlanModel: Model<WorkoutPlanDocument>,
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ─── Start Session ────────────────────────────────────────────────────────────

  async startSession(
    userId: string,
    dto: StartSessionDto,
  ): Promise<WorkoutSessionDocument> {
    // 1. Load the user's active plan
    const activePlan = await this.workoutPlanModel
      .findOne({ userId: new Types.ObjectId(userId), isActive: true })
      .exec();

    if (!activePlan) {
      throw new UnprocessableEntityException('No active plan found');
    }

    // 2. Find the matching day in the plan
    const planDay = activePlan.days.find((d) => d.dayOfWeek === dto.dayOfWeek);

    if (!planDay || planDay.exercises.length === 0) {
      throw new UnprocessableEntityException(
        'No exercises configured for this day in the active plan',
      );
    }

    // 3. Delete any existing in_progress session for this user.
    // Abandoned sessions carry no statistical value — deleting keeps the
    // collection clean and avoids polluting last-performance queries.
    await this.sessionModel
      .findOneAndDelete({
        userId: new Types.ObjectId(userId),
        status: SessionStatus.IN_PROGRESS,
      })
      .exec();

    // 4. Build exercises snapshot from the plan day
    const exercises: SessionExercise[] = planDay.exercises.map(
      (config, index) => ({
        exerciseId: config.exerciseId,
        exerciseName: config.exerciseName,
        orderIndex: index,
        supersetGroupId: config.supersetGroupId ?? undefined,
        trackingType: 'reps' as const,
        plannedSets: config.sets,
        plannedReps: config.reps ?? undefined,
        plannedDuration: config.duration ?? undefined,
        plannedWeight: config.weight ?? undefined,
        plannedRest: config.rest,
        sets: [],
        modifiedDuringSession: false,
      }),
    );

    // 5. Resolve trackingType from Exercise catalog and snapshot it
    const exerciseIds = exercises.map((e) => e.exerciseId);

    const exerciseDocs = await this.exerciseModel
      .find({ _id: { $in: exerciseIds } })
      .select('_id trackingType')
      .exec();

    const trackingTypeMap = new Map(
      exerciseDocs.map((e) => [
        e._id.toString(),
        e.trackingType as 'reps' | 'duration',
      ]),
    );

    exercises.forEach((ex) => {
      ex.trackingType = trackingTypeMap.get(ex.exerciseId.toString()) ?? 'reps';
    });

    // 7. Resolve lastPerformance per exercise
    const lastPerformanceMap = await this.resolveLastPerformance(
      userId,
      exerciseIds,
    );

    // 8. Persist the new session
    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      planId: activePlan._id,
      planName: activePlan.name,
      dayOfWeek: dto.dayOfWeek,
      status: SessionStatus.IN_PROGRESS,
      startedAt: new Date(),
      exercises,
    });

    // 7. Attach lastPerformance to the response (not persisted — computed on read)
    return this.attachLastPerformance(session, lastPerformanceMap);
  }

  // ─── Log Set ──────────────────────────────────────────────────────────────────

  async logSet(
    sessionId: string,
    userId: string,
    dto: LogSetDto,
  ): Promise<{ exerciseId: string; sets: SessionSet[] }> {
    const session = await this.findSessionAndVerifyOwnership(sessionId, userId);
    this.assertInProgress(session);

    const exercise = session.exercises.find(
      (e) => e.exerciseId.toString() === dto.exerciseId,
    );

    if (!exercise) {
      throw new UnprocessableEntityException(
        `Exercise ${dto.exerciseId} not found in this session`,
      );
    }

    // Eliminar cualquier set incompleto (completed === false) antes de registrar el nuevo set
    exercise.sets = exercise.sets.filter((s) => s.completed !== false);

    // Idempotent upsert by setIndex — handles mobile network retries
    const existingIndex = exercise.sets.findIndex(
      (s) => s.setIndex === dto.setIndex,
    );

    const newSet: SessionSet = {
      setIndex: dto.setIndex,
      reps: dto.reps ?? undefined,
      duration: dto.duration ?? undefined,
      weight: dto.weight ?? undefined,
      completed: dto.completed,
      loggedAt: new Date(),
    };

    if (existingIndex >= 0 && newSet.completed === false) {
      // Si el set existe y el nuevo set es incompleto, lo eliminamos
      exercise.sets.splice(existingIndex, 1);
      session.markModified('exercises');
      await session.save();
      return {
        exerciseId: dto.exerciseId,
        sets: exercise.sets,
      };
    }

    if (existingIndex >= 0) {
      exercise.sets[existingIndex] = newSet;
    } else {
      exercise.sets.push(newSet);
    }

    session.markModified('exercises');
    await session.save();

    return {
      exerciseId: dto.exerciseId,
      sets: exercise.sets,
    };
  }

  // ─── Replace Exercise ─────────────────────────────────────────────────────────
  // Replaces one exercise in the session with a different one from the catalog.
  // The original exercise slot (orderIndex, supersetGroupId) is preserved.
  // Any sets previously logged for the original exercise are discarded —
  // the user is switching exercises, not editing what they already did.

  async replaceExercise(
    sessionId: string,
    exerciseId: string,
    userId: string,
    dto: ReplaceExerciseDto,
  ): Promise<Omit<SessionExercise, 'sets'>> {
    const session = await this.findSessionAndVerifyOwnership(sessionId, userId);
    this.assertInProgress(session);

    const exerciseIndex = session.exercises.findIndex(
      (e) => e.exerciseId.toString() === exerciseId,
    );

    if (exerciseIndex === -1) {
      throw new UnprocessableEntityException(
        `Exercise ${exerciseId} not found in this session`,
      );
    }

    // Resolve new exercise from the catalog
    const newExercise = await this.exerciseModel
      .findOne({ _id: new Types.ObjectId(dto.newExerciseId), isActive: true })
      .select('_id name trackingType')
      .exec();

    if (!newExercise) {
      throw new NotFoundException(
        `Exercise ${dto.newExerciseId} not found in the catalog or is inactive`,
      );
    }

    const original = session.exercises[exerciseIndex];

    // Build the replacement preserving slot position and superset membership.
    // Planned config uses dto values if provided, otherwise falls back to
    // the original exercise's planned values.
    const replacement: SessionExercise = {
      exerciseId: newExercise._id as Types.ObjectId,
      exerciseName: newExercise.name,
      orderIndex: original.orderIndex,
      supersetGroupId: original.supersetGroupId,
      trackingType: (newExercise.trackingType as 'reps' | 'duration') ?? 'reps',
      plannedSets: dto.plannedSets ?? original.plannedSets,
      plannedReps: dto.plannedReps ?? original.plannedReps,
      plannedDuration: dto.plannedDuration ?? original.plannedDuration,
      plannedWeight: dto.plannedWeight ?? original.plannedWeight,
      plannedRest: dto.plannedRest ?? original.plannedRest,
      sets: [],
      modifiedDuringSession: true,
    };

    session.exercises[exerciseIndex] =
      replacement as (typeof session.exercises)[number];
    session.markModified('exercises');
    await session.save();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sets: _sets, ...replacementWithoutSets } = replacement;

    return replacementWithoutSets;
  }

  // ─── Finish Session ───────────────────────────────────────────────────────────

  async finishSession(
    sessionId: string,
    userId: string,
    dto: FinishSessionDto,
  ): Promise<WorkoutSessionDocument> {
    const session = await this.findSessionAndVerifyOwnership(sessionId, userId);
    this.assertInProgress(session);

    const finishedAt = new Date();
    const durationSeconds = Math.floor(
      (finishedAt.getTime() - session.startedAt.getTime()) / 1000,
    );

    // Strip exercises with no logged sets before persisting.
    // Exercises the user never touched carry no value in history or stats.
    session.exercises = session.exercises.filter(
      (e) => e.sets.length > 0,
    ) as typeof session.exercises;

    session.status = dto.status as SessionStatus;
    session.finishedAt = finishedAt;
    session.durationSeconds = durationSeconds;
    session.markModified('exercises');

    await session.save();

    // Flush entire cache: finishing a session invalidates session history,
    // stats (volume, muscles, exercise history) and plans simultaneously.
    await this.cacheManager.clear();

    return session;
  }

  // ─── Cancel Session ───────────────────────────────────────────────────────────

  async cancelActiveSession(userId: string): Promise<{ message: string }> {
    const deleted = await this.sessionModel
      .findOneAndDelete({
        userId: new Types.ObjectId(userId),
        status: SessionStatus.IN_PROGRESS,
      })
      .exec();

    if (!deleted) {
      throw new NotFoundException('No active session found');
    }

    return { message: 'Session cancelled successfully' };
  }

  // ─── Read Operations ──────────────────────────────────────────────────────────

  async getActiveSession(userId: string): Promise<WorkoutSessionDocument> {
    const session = await this.sessionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: SessionStatus.IN_PROGRESS,
      })
      .exec();

    if (!session) {
      throw new NotFoundException('No active session found');
    }

    const exerciseIds = session.exercises.map((e) => e.exerciseId);
    const lastPerformanceMap = await this.resolveLastPerformance(
      userId,
      exerciseIds,
    );

    return this.attachLastPerformance(session, lastPerformanceMap);
  }

  async getSessionById(
    sessionId: string,
    userId: string,
  ): Promise<WorkoutSessionDocument> {
    const key = `sessions:detail:${sessionId}`;
    const cached = await this.cacheManager.get<WorkoutSessionDocument>(key);
    if (cached) return cached;

    const session = await this.findSessionAndVerifyOwnership(sessionId, userId);
    await this.cacheManager.set(key, session, SESSIONS_CACHE_TTL);
    return session;
  }

  async getSessionHistory(
    userId: string,
    query: HistoryQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const key = `sessions:history:${userId}:${page}:${limit}`;
    const cached = await this.cacheManager.get(key);
    if (cached) return cached;

    const result = await this._getSessionHistory(userId, query);
    await this.cacheManager.set(key, result, SESSIONS_CACHE_TTL);
    return result;
  }

  private async _getSessionHistory(
    userId: string,
    query: HistoryQueryDto,
  ): Promise<{
    data: {
      _id: string;
      planName: string;
      dayOfWeek: string;
      status: SessionStatus;
      startedAt: Date;
      finishedAt?: Date;
      durationSeconds?: number;
      totalSetsLogged: number;
      exercises: {
        exerciseName: string;
        plannedSets: number;
        completedSets: number;
      }[];
    }[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter = {
      userId: new Types.ObjectId(userId),
      status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
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

    const data = sessions.map((session) => {
      const exercises = session.exercises.map((exercise) => ({
        exerciseName: exercise.exerciseName,
        plannedSets: exercise.plannedSets,
        completedSets: exercise.sets.filter((s) => s.completed).length,
      }));

      const totalSetsLogged = session.exercises.reduce(
        (acc, exercise) => acc + exercise.sets.length,
        0,
      );

      return {
        _id: session._id.toString(),
        planName: session.planName,
        dayOfWeek: session.dayOfWeek,
        status: session.status,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        durationSeconds: session.durationSeconds,
        totalSetsLogged,
        exercises,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPublicSessionHistory(
    targetUserId: string,
    query: PublicSessionHistoryQueryDto,
  ): Promise<{
    data: {
      _id: string;
      planName: string;
      dayOfWeek: string;
      status: SessionStatus;
      startedAt: Date;
      finishedAt?: Date;
      durationSeconds?: number;
      totalSetsLogged: number;
      volumeKg: number;
      exercises: {
        exerciseName: string;
        sets: {
          setIndex: number;
          reps?: number;
          durationSeconds?: number;
          weightKg?: number;
          completed: boolean;
        }[];
      }[];
    }[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter = {
      userId: new Types.ObjectId(targetUserId),
      status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
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

    const data = sessions.map((session) => {
      let totalSetsLogged = 0;
      let volumeKg = 0;

      const exercises = session.exercises.map((ex) => {
        const sets = ex.sets.map((s) => {
          if (s.completed) {
            totalSetsLogged++;
            if (s.weight != null && s.reps != null) {
              volumeKg += s.reps * s.weight;
            }
          }
          return {
            setIndex: s.setIndex,
            reps: s.reps,
            durationSeconds: s.duration,
            weightKg: s.weight,
            completed: s.completed,
          };
        });
        return { exerciseName: ex.exerciseName, sets };
      });

      return {
        _id: session._id.toString(),
        planName: session.planName,
        dayOfWeek: session.dayOfWeek,
        status: session.status,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        durationSeconds: session.durationSeconds,
        totalSetsLogged,
        volumeKg,
        exercises,
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async findSessionAndVerifyOwnership(
    sessionId: string,
    userId: string,
  ): Promise<WorkoutSessionDocument> {
    const session = await this.sessionModel.findById(sessionId).exec();

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId.toString() !== userId) {
      throw new ForbiddenException(
        'Session does not belong to the authenticated user',
      );
    }

    return session;
  }

  private assertInProgress(session: WorkoutSessionDocument): void {
    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new UnprocessableEntityException('Session is not in progress');
    }
  }

  // Resolves the most recent completed/partial session per exercise.
  // Returns a map of exerciseId (string) → sets array from that session.
  private async resolveLastPerformance(
    userId: string,
    exerciseIds: Types.ObjectId[],
  ): Promise<Map<string, SessionSet[]>> {
    const map = new Map<string, SessionSet[]>();

    if (exerciseIds.length === 0) return map;

    // One query per exercise — covered by the compound index
    // (userId, exercises.exerciseId, startedAt: -1)
    await Promise.all(
      exerciseIds.map(async (exerciseId) => {
        const pastSession = await this.sessionModel
          .findOne({
            userId: new Types.ObjectId(userId),
            status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
            'exercises.exerciseId': exerciseId,
          })
          .sort({ startedAt: -1 })
          .select('exercises startedAt _id')
          .exec();

        if (pastSession) {
          const pastExercise = pastSession.exercises.find(
            (e) => e.exerciseId.toString() === exerciseId.toString(),
          );
          if (pastExercise) {
            map.set(exerciseId.toString(), pastExercise.sets);
          }
        }
      }),
    );

    return map;
  }

  // Attaches lastPerformance to each exercise in the session response.
  // lastPerformance is a computed field — not stored in the document.
  private attachLastPerformance(
    session: WorkoutSessionDocument,
    lastPerformanceMap: Map<string, SessionSet[]>,
  ): WorkoutSessionDocument {
    const sessionObj = session.toObject() as WorkoutSessionDocument & {
      exercises: (SessionExercise & { lastPerformance: SessionSet[] | null })[];
    };

    sessionObj.exercises = sessionObj.exercises.map((exercise) => ({
      ...exercise,
      lastPerformance:
        lastPerformanceMap.get(exercise.exerciseId.toString()) ?? null,
    }));

    return sessionObj as unknown as WorkoutSessionDocument;
  }
}
