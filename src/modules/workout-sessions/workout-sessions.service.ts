import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
import { SessionStatus } from '../../common/enums/session-status.enum';
import { StartSessionDto } from './dto/start-session.dto';
import { LogSetDto } from './dto/log-set.dto';
import { ModifyExerciseDto } from './dto/modify-exercise.dto';
import { FinishSessionDto } from './dto/finish-session.dto';

@Injectable()
export class WorkoutSessionsService {
  constructor(
    @InjectModel(WorkoutSession.name)
    private readonly sessionModel: Model<WorkoutSessionDocument>,
    @InjectModel(WorkoutPlan.name)
    private readonly workoutPlanModel: Model<WorkoutPlanDocument>,
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

    // 3. Abandon any existing in_progress session for this user
    await this.sessionModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          status: SessionStatus.IN_PROGRESS,
        },
        { $set: { status: SessionStatus.ABANDONED, finishedAt: new Date() } },
      )
      .exec();

    // 4. Build exercises snapshot from the plan day
    const exercises: SessionExercise[] = planDay.exercises.map(
      (config, index) => ({
        exerciseId: config.exerciseId,
        exerciseName: config.exerciseName,
        orderIndex: index,
        supersetGroupId: config.supersetGroupId ?? undefined,
        plannedSets: config.sets,
        plannedReps: config.reps ?? undefined,
        plannedDuration: config.duration ?? undefined,
        plannedWeight: config.weight ?? undefined,
        plannedRest: config.rest,
        sets: [],
        modifiedDuringSession: false,
      }),
    );

    // 5. Resolve lastPerformance per exercise
    const exerciseIds = exercises.map((e) => e.exerciseId);
    const lastPerformanceMap = await this.resolveLastPerformance(
      userId,
      exerciseIds,
    );

    // 6. Persist the new session
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

  // ─── Modify Exercise ──────────────────────────────────────────────────────────

  async modifyExercise(
    sessionId: string,
    exerciseId: string,
    userId: string,
    dto: ModifyExerciseDto,
  ): Promise<Omit<SessionExercise, 'sets'>> {
    const session = await this.findSessionAndVerifyOwnership(sessionId, userId);
    this.assertInProgress(session);

    const exercise = session.exercises.find(
      (e) => e.exerciseId.toString() === exerciseId,
    );

    if (!exercise) {
      throw new UnprocessableEntityException(
        `Exercise ${exerciseId} not found in this session`,
      );
    }

    // Merge only the provided fields — existing sets[] are untouched
    if (dto.plannedSets !== undefined) exercise.plannedSets = dto.plannedSets;
    if (dto.plannedReps !== undefined) exercise.plannedReps = dto.plannedReps;
    if (dto.plannedDuration !== undefined)
      exercise.plannedDuration = dto.plannedDuration;
    if (dto.plannedWeight !== undefined)
      exercise.plannedWeight = dto.plannedWeight;
    if (dto.plannedRest !== undefined) exercise.plannedRest = dto.plannedRest;

    exercise.modifiedDuringSession = true;

    session.markModified('exercises');
    await session.save();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sets: _sets, ...exerciseWithoutSets } =
      exercise as unknown as SessionExercise;

    return exerciseWithoutSets;
  }

  // ─── Finish Session ───────────────────────────────────────────────────────────

  async finishSession(
    sessionId: string,
    userId: string,
    dto: FinishSessionDto,
  ): Promise<{
    _id: string;
    status: SessionStatus;
    startedAt: Date;
    finishedAt: Date;
    durationSeconds: number;
    exercisesCompleted: number;
    totalSetsLogged: number;
  }> {
    const session = await this.findSessionAndVerifyOwnership(sessionId, userId);
    this.assertInProgress(session);

    const finishedAt = new Date();
    const durationSeconds = Math.floor(
      (finishedAt.getTime() - session.startedAt.getTime()) / 1000,
    );

    const exercisesCompleted = session.exercises.filter((e) =>
      e.sets.some((s) => s.completed),
    ).length;

    const totalSetsLogged = session.exercises.reduce(
      (acc, e) => acc + e.sets.length,
      0,
    );

    session.status = dto.status as SessionStatus;
    session.finishedAt = finishedAt;
    session.durationSeconds = durationSeconds;

    await session.save();

    return {
      _id: session._id.toString(),
      status: session.status,
      startedAt: session.startedAt,
      finishedAt,
      durationSeconds,
      exercisesCompleted,
      totalSetsLogged,
    };
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
    return this.findSessionAndVerifyOwnership(sessionId, userId);
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
