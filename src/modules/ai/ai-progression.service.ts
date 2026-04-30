import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WorkoutPlan,
  WorkoutPlanDocument,
  ExerciseConfig,
} from '../../schemas/workout-plan.schema';
import {
  WorkoutSession,
  WorkoutSessionDocument,
  SessionSet,
} from '../../schemas/workout-session.schema';
import {
  ProgressionLog,
  ProgressionLogDocument,
  ExerciseChange,
} from '../../schemas/progression-log.schema';
import {
  AiPlanProfile,
  AiPlanProfileDocument,
} from '../../schemas/ai-plan-profile.schema';
import {
  SessionStatus,
  ProgressionChangeType,
  AiExperienceLevel,
} from '../../common/enums';
import { WorkoutPlansService } from '../workout-plans/workout-plans.service';
import {
  ExerciseChangeResponseDto,
  ProgressionAnalysisResponseDto,
} from './dto/progression-analysis-response.dto';

const LOOKBACK_WEEKS = 4;
const MIN_SESSIONS_FOR_PROGRESSION = 2;
const DECLINE_WEEKS_TRIGGER = 3;
const STAGNATION_WEEKS_TRIGGER = 3;
const INCONSISTENCY_THRESHOLD = 0.5;
const NEAR_INCONSISTENCY_THRESHOLD = 0.7;

type DeloadType = 'full' | 'volume' | 'weight';

@Injectable()
export class AiProgressionService {
  private readonly logger = new Logger(AiProgressionService.name);

  constructor(
    @InjectModel(WorkoutPlan.name)
    private readonly workoutPlanModel: Model<WorkoutPlanDocument>,
    @InjectModel(WorkoutSession.name)
    private readonly sessionModel: Model<WorkoutSessionDocument>,
    @InjectModel(ProgressionLog.name)
    private readonly progressionLogModel: Model<ProgressionLogDocument>,
    @InjectModel(AiPlanProfile.name)
    private readonly aiPlanProfileModel: Model<AiPlanProfileDocument>,
    private readonly workoutPlansService: WorkoutPlansService,
  ) {}

  // ─── Public: manual trigger — proposes changes, does NOT apply them ───────────

  async analyzeOnly(userId: string): Promise<ProgressionAnalysisResponseDto> {
    return this.runAnalysis(userId, false);
  }

  // ─── Public: confirm a pending progression log ────────────────────────────────

  async confirmProgression(
    logId: string,
    userId: string,
    apply: boolean,
  ): Promise<ProgressionAnalysisResponseDto> {
    const log = await this.progressionLogModel.findById(logId).exec();

    if (!log) {
      throw new NotFoundException('Progression log not found');
    }

    if (log.userId.toString() !== userId) {
      throw new UnauthorizedException(
        'Log does not belong to the authenticated user',
      );
    }

    if (log.status !== 'pending') {
      throw new ConflictException('Progression log has already been processed');
    }

    if (apply) {
      const changeMap = this.buildChangeMap(log.changes);
      if (changeMap.size > 0) {
        await this.workoutPlansService.applyExerciseChanges(
          log.planId.toString(),
          userId,
          changeMap,
        );
      }
      log.status = 'applied';
      log.appliedAt = new Date();
    } else {
      log.status = 'rejected';
    }

    await log.save();

    return {
      logId: log._id.toString(),
      planId: log.planId.toString(),
      isDeloadWeek: log.isDeloadWeek,
      status: log.status,
      changesApplied: log.changes.map((c) => this.toChangeResponse(c)),
      message: apply
        ? 'Progression changes applied to your plan'
        : 'Progression changes rejected — plan unchanged',
    };
  }

  // ─── Public: fetch the current week's log for the active plan ────────────────

  async getCurrentWeekAnalysis(
    userId: string,
  ): Promise<ProgressionAnalysisResponseDto | null> {
    const plan = await this.workoutPlanModel
      .findOne({ userId: new Types.ObjectId(userId), isActive: true })
      .select('_id')
      .lean()
      .exec();

    if (!plan) return null;

    const weekNumber = this.getIsoWeekStart(new Date());
    const log = await this.progressionLogModel
      .findOne({
        userId: new Types.ObjectId(userId),
        planId: plan._id,
        weekNumber,
      })
      .exec();

    if (!log) return null;

    return {
      logId: log._id.toString(),
      planId: log.planId.toString(),
      isDeloadWeek: log.isDeloadWeek,
      status: log.status,
      changesApplied: log.changes.map((c) => this.toChangeResponse(c)),
      message:
        log.status === 'applied'
          ? 'Progression changes applied to your plan'
          : log.status === 'rejected'
            ? 'Progression changes rejected — plan unchanged'
            : 'Progression analysis pending your confirmation',
    };
  }

  // ─── Internal: cron — proposes AND applies immediately ───────────────────────

  async analyzeAndApplyForCron(userId: string): Promise<void> {
    await this.runAnalysis(userId, true);
  }

  // ─── Core analysis logic ──────────────────────────────────────────────────────

  private async runAnalysis(
    userId: string,
    applyImmediately: boolean,
  ): Promise<ProgressionAnalysisResponseDto> {
    const plan = await this.workoutPlanModel
      .findOne({ userId: new Types.ObjectId(userId), isActive: true })
      .exec();

    if (!plan) {
      return {
        logId: '',
        planId: '',
        isDeloadWeek: false,
        status: 'failed',
        changesApplied: [],
        message: 'No active plan found. Progression analysis skipped.',
      };
    }

    const planId = plan._id.toString();

    const alreadyDone = await this.wasAlreadyProcessedThisWeek(userId, planId);
    if (alreadyDone) {
      return {
        logId: '',
        planId,
        isDeloadWeek: false,
        status: 'failed',
        changesApplied: [],
        message: 'Progression already analyzed this week.',
      };
    }

    const hasData = await this.hasSessionsInBothRecentWeeks(userId, planId);
    if (!hasData) {
      return {
        logId: '',
        planId,
        isDeloadWeek: false,
        status: 'failed',
        changesApplied: [],
        message:
          'Not enough training data: complete at least one session each week for the past 2 weeks before running progression analysis.',
      };
    }

    const sessionData = await this.getRecentSessionData(
      userId,
      planId,
      LOOKBACK_WEEKS,
    );
    const changes: ExerciseChange[] = [];

    for (const day of plan.days) {
      for (const exercise of day.exercises) {
        // Only evaluate reps-based exercises (duration exercises use time, not weight progression)
        if (!exercise.reps) continue;

        const exerciseIdStr = exercise.exerciseId.toString();
        const recentSets = sessionData.get(exerciseIdStr) ?? [];
        const partial = this.evaluateDoubleProgression(exercise, recentSets);
        if (partial) {
          changes.push({
            ...partial,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
          } as ExerciseChange);
        }
      }
    }

    const deloadType = await this.evaluateDeloadNeed(userId, planId, plan);
    let isDeloadWeek = false;
    let finalChanges = changes;

    if (deloadType) {
      isDeloadWeek = true;
      finalChanges = this.applyDeloadWeek(plan, deloadType);
    }

    const logStatus: 'pending' | 'applied' = applyImmediately
      ? 'applied'
      : 'pending';

    if (applyImmediately && finalChanges.length > 0) {
      const changeMap = this.buildChangeMap(finalChanges);
      await this.workoutPlansService.applyExerciseChanges(
        planId,
        userId,
        changeMap,
      );
    }

    const weekNumber = this.getIsoWeekStart(new Date());
    let logDoc: ProgressionLogDocument;

    try {
      logDoc = await this.progressionLogModel.create({
        userId: new Types.ObjectId(userId),
        planId: new Types.ObjectId(planId),
        source: applyImmediately ? 'weekly_cron' : 'manual_trigger',
        isDeloadWeek,
        changes: finalChanges,
        weekNumber,
        status: logStatus,
        ...(applyImmediately ? { appliedAt: new Date() } : {}),
      });
    } catch (err: unknown) {
      // Unique index violation — already processed this week
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        return {
          logId: '',
          planId,
          isDeloadWeek: false,
          status: 'failed',
          changesApplied: [],
          message: 'Progression already analyzed this week.',
        };
      }
      throw err;
    }

    const deloadMessages: Record<DeloadType, string> = {
      full: 'Deload week proposed: volume −40% and weight −10%',
      volume: 'Deload week proposed: volume −40% (sets reduced)',
      weight: 'Deload week proposed: weight −10%',
    };

    const message = isDeloadWeek
      ? deloadMessages[deloadType as DeloadType]
      : finalChanges.length > 0
        ? `${finalChanges.length} exercise(s) ready for review`
        : 'No changes needed — keep current weights';

    return {
      logId: logDoc._id.toString(),
      planId,
      isDeloadWeek,
      status: logStatus,
      changesApplied: finalChanges.map((c) => this.toChangeResponse(c)),
      message,
    };
  }

  // ─── Session gate ─────────────────────────────────────────────────────────────

  private async hasSessionsInBothRecentWeeks(
    userId: string,
    planId: string,
  ): Promise<boolean> {
    const thisWeekStart = this.getIsoWeekStart(new Date());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

    const userOid = new Types.ObjectId(userId);
    const planOid = new Types.ObjectId(planId);
    const statusFilter = {
      $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL],
    };

    const [thisWeekCount, lastWeekCount] = await Promise.all([
      this.sessionModel.countDocuments({
        userId: userOid,
        planId: planOid,
        status: statusFilter,
        startedAt: { $gte: thisWeekStart },
      }),
      this.sessionModel.countDocuments({
        userId: userOid,
        planId: planOid,
        status: statusFilter,
        startedAt: { $gte: lastWeekStart, $lt: thisWeekStart },
      }),
    ]);

    return thisWeekCount > 0 && lastWeekCount > 0;
  }

  // ─── Deload evaluation ────────────────────────────────────────────────────────

  private async evaluateDeloadNeed(
    userId: string,
    planId: string,
    plan: WorkoutPlanDocument,
  ): Promise<DeloadType | false> {
    // A — Beginner exclusion (only applies to AI plans that have a profile)
    const profile = await this.aiPlanProfileModel
      .findOne({ planId: new Types.ObjectId(planId) })
      .lean()
      .exec();

    if (profile && profile.experience === AiExperienceLevel.BEGINNER) {
      return false;
    }

    // B — Inconsistency exclusion + compute session rate for later intensity decision
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_WEEKS * 7);

    const actualSessions = await this.sessionModel.countDocuments({
      userId: new Types.ObjectId(userId),
      planId: new Types.ObjectId(planId),
      status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
      startedAt: { $gte: since },
    });

    const scheduledSessions = plan.days.length * LOOKBACK_WEEKS;
    const sessionRate =
      scheduledSessions > 0 ? actualSessions / scheduledSessions : 1;

    if (sessionRate < INCONSISTENCY_THRESHOLD) {
      return false;
    }

    // C — Decline signal: last DECLINE_WEEKS_TRIGGER non-deload logs each have a WEIGHT_DECREASE
    const recentLogs = await this.progressionLogModel
      .find({
        userId: new Types.ObjectId(userId),
        planId: new Types.ObjectId(planId),
        isDeloadWeek: false,
      })
      .sort({ createdAt: -1 })
      .limit(DECLINE_WEEKS_TRIGGER)
      .lean()
      .exec();

    const declineSignal =
      recentLogs.length >= DECLINE_WEEKS_TRIGGER &&
      recentLogs.every((log) =>
        log.changes.some(
          (c) => c.changeType === ProgressionChangeType.WEIGHT_DECREASE,
        ),
      );

    // D — Stagnation signal: majority of exercises had no change across recent logs
    const totalExercises = plan.days.reduce(
      (sum, day) => sum + day.exercises.length,
      0,
    );

    const logsForStagnation = recentLogs.slice(0, STAGNATION_WEEKS_TRIGGER);
    const exercisesWithChanges = new Set<string>();
    for (const log of logsForStagnation) {
      for (const change of log.changes) {
        exercisesWithChanges.add(
          (change.exerciseId as Types.ObjectId).toString(),
        );
      }
    }
    const stagnantCount = totalExercises - exercisesWithChanges.size;
    const stagnationSignal =
      logsForStagnation.length >= STAGNATION_WEEKS_TRIGGER &&
      stagnantCount >= Math.ceil(totalExercises / 2);

    if (!declineSignal && !stagnationSignal) {
      return false;
    }

    // E — Determine intensity
    if (declineSignal && stagnationSignal) return 'full';
    if (declineSignal && sessionRate < NEAR_INCONSISTENCY_THRESHOLD)
      return 'full';
    if (declineSignal) return 'volume';
    return 'weight';
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private buildChangeMap(changes: ExerciseChange[]): Map<
    string,
    {
      weight?: number;
      sets?: number;
      reps?: number;
      repsMax?: number;
      leftWeight?: number;
      rightWeight?: number;
    }
  > {
    const changeMap = new Map<
      string,
      {
        weight?: number;
        sets?: number;
        reps?: number;
        repsMax?: number;
        leftWeight?: number;
        rightWeight?: number;
      }
    >();

    for (const change of changes) {
      const existing = changeMap.get(change.exerciseId.toString()) ?? {};
      if (change.newWeight !== undefined) existing.weight = change.newWeight;
      if (change.newSets !== undefined) existing.sets = change.newSets;
      if (change.newReps !== undefined) existing.reps = change.newReps;
      if (change.newLeftWeight !== undefined)
        existing.leftWeight = change.newLeftWeight;
      if (change.newRightWeight !== undefined)
        existing.rightWeight = change.newRightWeight;
      changeMap.set(change.exerciseId.toString(), existing);
    }

    return changeMap;
  }

  async getRecentSessionData(
    userId: string,
    planId: string,
    weeks: number,
  ): Promise<Map<string, SessionSet[][]>> {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const sessions = await this.sessionModel
      .find({
        userId: new Types.ObjectId(userId),
        planId: new Types.ObjectId(planId),
        status: { $in: [SessionStatus.COMPLETED, SessionStatus.PARTIAL] },
        startedAt: { $gte: since },
      })
      .sort({ startedAt: -1 })
      .select('exercises startedAt')
      .lean()
      .exec();

    const map = new Map<string, SessionSet[][]>();

    for (const session of sessions) {
      for (const exercise of session.exercises) {
        const key = (exercise.exerciseId as Types.ObjectId).toString();
        const completedSets = (exercise.sets as SessionSet[]).filter(
          (s) => s.completed,
        );
        if (completedSets.length === 0) continue;

        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(completedSets);
      }
    }

    return map;
  }

  evaluateDoubleProgression(
    exercise: ExerciseConfig,
    recentSets: SessionSet[][],
  ): Partial<ExerciseChange> | null {
    if (recentSets.length < MIN_SESSIONS_FOR_PROGRESSION) return null;

    const repsMin = exercise.reps ?? 8;
    const repsMax = exercise.repsMax ?? repsMin + 2;
    const plannedWeight = exercise.weight ?? 0;

    const lastTwo = recentSets.slice(0, MIN_SESSIONS_FOR_PROGRESSION);

    const allHitMax = lastTwo.every((session) =>
      session.every((s) => (s.reps ?? 0) >= repsMax),
    );

    const anyFailed = lastTwo.some((session) =>
      session.some((s) => (s.reps ?? 0) < 6),
    );

    if (allHitMax) {
      const increment = plannedWeight < 40 ? 2.5 : 5;
      return {
        changeType: ProgressionChangeType.WEIGHT_INCREASE,
        previousWeight: plannedWeight,
        newWeight: plannedWeight + increment,
        reasoning: `Hit top-end reps (${repsMax}) on all sets for ${MIN_SESSIONS_FOR_PROGRESSION} consecutive sessions`,
      };
    }

    if (anyFailed) {
      const decreased = Math.max(0, plannedWeight * 0.9);
      const rounded = Math.round(decreased / 2.5) * 2.5;
      return {
        changeType: ProgressionChangeType.WEIGHT_DECREASE,
        previousWeight: plannedWeight,
        newWeight: rounded,
        reasoning:
          'Failed minimum reps (<6) in a recent session — reducing weight',
      };
    }

    return null;
  }

  applyDeloadWeek(
    plan: WorkoutPlanDocument,
    type: DeloadType,
  ): ExerciseChange[] {
    const changes: ExerciseChange[] = [];

    const reasoningMap: Record<DeloadType, string> = {
      full: 'Deload week: volume −40% and weight −10% (decline + inconsistency)',
      volume: 'Deload week: volume −40% (performance decline detected)',
      weight: 'Deload week: weight −10% (stagnation detected)',
    };
    const reasoning = reasoningMap[type];

    for (const day of plan.days) {
      for (const exercise of day.exercises) {
        const newSets =
          type !== 'weight'
            ? Math.max(1, Math.round(exercise.sets * 0.6))
            : undefined;

        if (!exercise.bilateral) {
          const newLeftWeight =
            type !== 'volume' && exercise.left?.weight != null
              ? Math.round((exercise.left.weight * 0.9) / 2.5) * 2.5
              : undefined;
          const newRightWeight =
            type !== 'volume' && exercise.right?.weight != null
              ? Math.round((exercise.right.weight * 0.9) / 2.5) * 2.5
              : undefined;

          changes.push({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            changeType: ProgressionChangeType.DELOAD,
            previousSets: exercise.sets,
            newSets,
            previousLeftWeight: exercise.left?.weight,
            newLeftWeight,
            previousRightWeight: exercise.right?.weight,
            newRightWeight,
            reasoning,
          } as ExerciseChange);
        } else {
          const newWeight =
            type !== 'volume' && exercise.weight != null
              ? Math.round((exercise.weight * 0.9) / 2.5) * 2.5
              : undefined;

          changes.push({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            changeType: ProgressionChangeType.DELOAD,
            previousSets: exercise.sets,
            newSets,
            previousWeight: exercise.weight,
            newWeight,
            reasoning,
          });
        }
      }
    }

    return changes;
  }

  async wasAlreadyProcessedThisWeek(
    userId: string,
    planId: string,
  ): Promise<boolean> {
    const weekNumber = this.getIsoWeekStart(new Date());
    const existing = await this.progressionLogModel
      .findOne({
        userId: new Types.ObjectId(userId),
        planId: new Types.ObjectId(planId),
        weekNumber,
      })
      .exec();
    return existing !== null;
  }

  getIsoWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private toChangeResponse(change: ExerciseChange): ExerciseChangeResponseDto {
    return {
      exerciseId: change.exerciseId.toString(),
      exerciseName: change.exerciseName,
      changeType: change.changeType,
      previousWeight: change.previousWeight ?? null,
      newWeight: change.newWeight ?? null,
      previousLeftWeight: change.previousLeftWeight ?? null,
      newLeftWeight: change.newLeftWeight ?? null,
      previousRightWeight: change.previousRightWeight ?? null,
      newRightWeight: change.newRightWeight ?? null,
      previousSets: change.previousSets ?? null,
      newSets: change.newSets ?? null,
      previousReps: change.previousReps ?? null,
      newReps: change.newReps ?? null,
      reasoning: change.reasoning,
    };
  }
}
