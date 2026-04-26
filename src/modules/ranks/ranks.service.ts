import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  ExerciseRank,
  ExerciseRankDocument,
} from '../../schemas/exercise-rank.schema';
import {
  MuscleRank,
  MuscleRankDocument,
} from '../../schemas/muscle-rank.schema';
import { Exercise, ExerciseDocument } from '../../schemas/exercise.schema';
import { Follow, FollowDocument } from '../../schemas/follow.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import {
  WorkoutSession,
  WorkoutSessionDocument,
} from '../../schemas/workout-session.schema';
import {
  MuscleGroup,
  LoadType,
  WeightUnit,
  RankLevel,
  RANK_NAMES,
} from '../../common/enums';
import { RanksCalculator } from './ranks.calculator';
import { SessionCompletedForRanksEvent } from './events/rank.events';
import {
  ExerciseRankDetailDto,
  MuscleRankEntryDto,
} from './dto/muscle-rank-response.dto';
import {
  LeaderboardResponseDto,
  LeaderboardUserEntryDto,
} from './dto/leaderboard-response.dto';

const LBS_TO_KG = 2.20462;
const RANKS_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class RanksService {
  private readonly logger = new Logger(RanksService.name);

  constructor(
    @InjectModel(ExerciseRank.name)
    private readonly exerciseRankModel: Model<ExerciseRankDocument>,
    @InjectModel(MuscleRank.name)
    private readonly muscleRankModel: Model<MuscleRankDocument>,
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    @InjectModel(WorkoutSession.name)
    private readonly sessionModel: Model<WorkoutSessionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly calculator: RanksCalculator,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ─── Session Completion Processing ───────────────────────────────────────────

  async processSessionCompletion(
    userId: string,
    sessionExercises: SessionCompletedForRanksEvent['exercises'],
  ): Promise<void> {
    const exerciseObjectIds = sessionExercises.map(
      (e) => new Types.ObjectId(e.exerciseId),
    );

    // Batch-fetch catalog data for all exercises in the session
    const catalogEntries = await this.exerciseModel
      .find({ _id: { $in: exerciseObjectIds } })
      .select('_id name trackingType loadType musclesPrimary bilateral')
      .lean()
      .exec();

    const catalogMap = new Map(
      catalogEntries.map((e) => [e._id.toString(), e]),
    );

    const musclesUpdated = new Set<MuscleGroup>();

    await Promise.all(
      sessionExercises.map(async (sessionExercise) => {
        const catalog = catalogMap.get(sessionExercise.exerciseId);
        if (!catalog) return; // deactivated exercise — skip

        const hasCompletedSet = sessionExercise.sets.some((s) => s.completed);
        if (!hasCompletedSet) return;

        // Fetch all-time best sets for this exercise via aggregation
        const allSets = await this.fetchAllTimeSets(
          userId,
          sessionExercise.exerciseId,
        );

        // Normalize lbs → kg for weighted exercises
        const normalizedSets = allSets.map((s) => {
          if (sessionExercise.weightUnit === WeightUnit.LBS) {
            return {
              ...s,
              weight: s.weight != null ? s.weight / LBS_TO_KG : undefined,
              left: s.left
                ? {
                    ...s.left,
                    weight:
                      s.left.weight != null
                        ? s.left.weight / LBS_TO_KG
                        : undefined,
                  }
                : undefined,
              right: s.right
                ? {
                    ...s.right,
                    weight:
                      s.right.weight != null
                        ? s.right.weight / LBS_TO_KG
                        : undefined,
                  }
                : undefined,
            };
          }
          return s;
        });

        const bestValue = this.calculator.computeBestValue(
          normalizedSets as any,
          catalog.trackingType,
          catalog.loadType as LoadType,
          catalog.bilateral ?? true,
        );

        const thresholds = this.calculator.getThresholds(
          catalog.name,
          catalog.trackingType,
          catalog.loadType as LoadType,
          catalog.musclesPrimary as MuscleGroup[],
        );

        const newRank = this.calculator.deriveRank(bestValue, thresholds);

        await this.exerciseRankModel
          .findOneAndUpdate(
            {
              userId: new Types.ObjectId(userId),
              exerciseId: new Types.ObjectId(sessionExercise.exerciseId),
            },
            {
              $max: { rank: newRank },
              $set: {
                exerciseName: sessionExercise.exerciseName,
                bestValue,
                updatedAt: new Date(),
              },
            },
            { upsert: true, new: true },
          )
          .exec();

        for (const muscle of catalog.musclesPrimary as MuscleGroup[]) {
          musclesUpdated.add(muscle);
        }
      }),
    );

    // Recompute muscle ranks for all touched muscles
    await Promise.all(
      Array.from(musclesUpdated).map((muscle) =>
        this.recomputeMuscleRank(userId, muscle),
      ),
    );

    // Invalidate muscle ranks cache for this user
    await this.cacheManager.del(`ranks:muscles:${userId}:all`);
    for (const muscle of musclesUpdated) {
      await this.cacheManager.del(`ranks:muscles:${userId}:${muscle}`);
    }
  }

  private async fetchAllTimeSets(
    userId: string,
    exerciseId: string,
  ): Promise<any[]> {
    const exerciseObjectId = new Types.ObjectId(exerciseId);
    const userObjectId = new Types.ObjectId(userId);

    const result = await this.sessionModel
      .aggregate([
        {
          $match: {
            userId: userObjectId,
            status: { $in: ['completed', 'partial'] },
            'exercises.exerciseId': exerciseObjectId,
          },
        },
        { $unwind: '$exercises' },
        { $match: { 'exercises.exerciseId': exerciseObjectId } },
        { $unwind: '$exercises.sets' },
        { $match: { 'exercises.sets.completed': true } },
        {
          $project: {
            _id: 0,
            setIndex: '$exercises.sets.setIndex',
            reps: '$exercises.sets.reps',
            duration: '$exercises.sets.duration',
            weight: '$exercises.sets.weight',
            left: '$exercises.sets.left',
            right: '$exercises.sets.right',
            completed: '$exercises.sets.completed',
            loggedAt: '$exercises.sets.loggedAt',
            weightUnit: '$exercises.weightUnit',
          },
        },
      ])
      .exec();

    return result;
  }

  private async recomputeMuscleRank(
    userId: string,
    muscle: MuscleGroup,
  ): Promise<void> {
    const exercisesInMuscle = await this.exerciseModel
      .find({ musclesPrimary: muscle })
      .select('_id')
      .lean()
      .exec();

    if (exercisesInMuscle.length === 0) return;

    const exerciseIds = exercisesInMuscle.map((e) => e._id);

    const rankDocs = await this.exerciseRankModel
      .find({
        userId: new Types.ObjectId(userId),
        exerciseId: { $in: exerciseIds },
      })
      .select('rank')
      .lean()
      .exec();

    if (rankDocs.length === 0) return;

    const sum = rankDocs.reduce((acc, doc) => acc + doc.rank, 0);
    const muscleRank = Math.max(1, Math.floor(sum / rankDocs.length));

    await this.muscleRankModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId), muscle },
        { $max: { rank: muscleRank }, $set: { updatedAt: new Date() } },
        { upsert: true },
      )
      .exec();
  }

  // ─── Get Muscle Ranks ─────────────────────────────────────────────────────────

  async getMuscleRanks(
    userId: string,
    muscles?: MuscleGroup[],
  ): Promise<MuscleRankEntryDto[]> {
    const cacheKey = `ranks:muscles:${userId}:${muscles?.join(',') ?? 'all'}`;
    const cached = await this.cacheManager.get<MuscleRankEntryDto[]>(cacheKey);
    if (cached) return cached;

    const filter: Record<string, any> = {
      userId: new Types.ObjectId(userId),
    };
    if (muscles && muscles.length > 0) {
      filter.muscle = { $in: muscles };
    }

    const muscleRankDocs = await this.muscleRankModel
      .find(filter)
      .lean()
      .exec();

    const result = await this.buildMuscleRankEntries(userId, muscleRankDocs);

    await this.cacheManager.set(cacheKey, result, RANKS_CACHE_TTL);
    return result;
  }

  private async buildMuscleRankEntries(
    userId: string,
    muscleRankDocs: Array<{
      muscle: MuscleGroup;
      rank: number;
      updatedAt: Date;
    }>,
  ): Promise<MuscleRankEntryDto[]> {
    if (muscleRankDocs.length === 0) return [];

    const muscles = muscleRankDocs.map((d) => d.muscle);

    // Batch-fetch all exercise IDs for the relevant muscles
    const exercisesInMuscles = await this.exerciseModel
      .find({ musclesPrimary: { $in: muscles } })
      .select('_id musclesPrimary')
      .lean()
      .exec();

    // Group exercise IDs by muscle
    const exerciseIdsByMuscle = new Map<MuscleGroup, Types.ObjectId[]>();
    for (const ex of exercisesInMuscles) {
      for (const muscle of ex.musclesPrimary as MuscleGroup[]) {
        if (muscles.includes(muscle)) {
          if (!exerciseIdsByMuscle.has(muscle)) {
            exerciseIdsByMuscle.set(muscle, []);
          }
          exerciseIdsByMuscle.get(muscle)!.push(ex._id as Types.ObjectId);
        }
      }
    }

    // Fetch all exercise ranks for this user across all relevant exercises
    const allExerciseIds = exercisesInMuscles.map((e) => e._id);
    const exerciseRankDocs = await this.exerciseRankModel
      .find({
        userId: new Types.ObjectId(userId),
        exerciseId: { $in: allExerciseIds },
      })
      .lean()
      .exec();

    const exerciseRankMap = new Map(
      exerciseRankDocs.map((d) => [d.exerciseId.toString(), d]),
    );

    return muscleRankDocs.map((muscleDoc) => {
      const exIds = exerciseIdsByMuscle.get(muscleDoc.muscle) ?? [];
      const exercises: ExerciseRankDetailDto[] = exIds
        .map((id) => exerciseRankMap.get(id.toString()))
        .filter((d): d is NonNullable<typeof d> => d != null)
        .map((d) => ({
          exerciseId: d.exerciseId.toString(),
          exerciseName: d.exerciseName,
          rank: d.rank,
          rankName: RANK_NAMES[d.rank as RankLevel],
          bestValue: d.bestValue,
          updatedAt: d.updatedAt,
        }));

      return {
        muscle: muscleDoc.muscle,
        rank: muscleDoc.rank,
        rankName: RANK_NAMES[muscleDoc.rank as RankLevel],
        exercises,
      };
    });
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────────

  async getLeaderboard(
    userId: string,
    muscle: MuscleGroup | undefined,
    page: number,
    limit: number,
  ): Promise<LeaderboardResponseDto> {
    // Get all users the caller follows
    const followDocs = await this.followModel
      .find({ followerId: new Types.ObjectId(userId) })
      .select('followingId')
      .lean()
      .exec();

    const followingIds = followDocs.map((f) => f.followingId);

    let total = 0;
    let pageUserIds: Types.ObjectId[] = [];

    if (muscle) {
      // Filter leaderboard by a single muscle
      total = await this.muscleRankModel.countDocuments({
        userId: { $in: followingIds },
        muscle,
      });

      const skip = (page - 1) * limit;
      const pageDocs = await this.muscleRankModel
        .find({ userId: { $in: followingIds }, muscle })
        .sort({ rank: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      pageUserIds = pageDocs.map((d) => d.userId as Types.ObjectId);
    } else {
      // No muscle filter: rank users by their highest muscle rank
      const skip = (page - 1) * limit;
      const agg = await this.muscleRankModel
        .aggregate([
          { $match: { userId: { $in: followingIds } } },
          { $group: { _id: '$userId', maxRank: { $max: '$rank' } } },
          { $sort: { maxRank: -1 } },
          { $count: 'total' },
        ])
        .exec();

      total = agg[0]?.total ?? 0;

      const pageDocs = await this.muscleRankModel
        .aggregate([
          { $match: { userId: { $in: followingIds } } },
          { $group: { _id: '$userId', maxRank: { $max: '$rank' } } },
          { $sort: { maxRank: -1 } },
          { $skip: skip },
          { $limit: limit },
        ])
        .exec();

      pageUserIds = pageDocs.map((d) => d._id as Types.ObjectId);
    }

    // Fetch user profiles for page users + caller
    const allUserIds = [new Types.ObjectId(userId), ...pageUserIds];
    const userDocs = await this.fetchUserProfiles(allUserIds);
    const userMap = new Map(userDocs.map((u) => [u._id.toString(), u]));

    // Build caller's own entry
    const selfMuscleRanks = await this.getMuscleRanksForUser(
      userId,
      muscle ? [muscle] : undefined,
    );
    const selfProfile = userMap.get(userId);
    const self: LeaderboardUserEntryDto = {
      userId,
      username: selfProfile?.username ?? '',
      avatar: selfProfile?.avatar ?? null,
      isSelf: true,
      muscleRanks: selfMuscleRanks,
    };

    // Build entries for followed users on this page
    const data = await Promise.all(
      pageUserIds.map(async (uid) => {
        const uidStr = uid.toString();
        const profile = userMap.get(uidStr);
        const muscleRanks = await this.getMuscleRanksForUser(
          uidStr,
          muscle ? [muscle] : undefined,
        );
        return {
          userId: uidStr,
          username: profile?.username ?? '',
          avatar: profile?.avatar ?? null,
          isSelf: false,
          muscleRanks,
        } satisfies LeaderboardUserEntryDto;
      }),
    );

    return {
      self,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async getMuscleRanksForUser(
    userId: string,
    muscles?: MuscleGroup[],
  ): Promise<MuscleRankEntryDto[]> {
    const filter: Record<string, any> = {
      userId: new Types.ObjectId(userId),
    };
    if (muscles && muscles.length > 0) {
      filter.muscle = { $in: muscles };
    }

    const muscleRankDocs = await this.muscleRankModel
      .find(filter)
      .lean()
      .exec();

    return this.buildMuscleRankEntries(userId, muscleRankDocs);
  }

  private async fetchUserProfiles(
    userIds: Types.ObjectId[],
  ): Promise<
    Array<{ _id: Types.ObjectId; username: string; avatar?: string }>
  > {
    return this.userModel
      .find({ _id: { $in: userIds } })
      .select('username avatar')
      .lean()
      .exec() as Promise<any[]>;
  }
}
