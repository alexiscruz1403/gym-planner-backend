import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  WorkoutPlan,
  WorkoutPlanDocument,
  ExerciseConfig,
} from '../../schemas/workout-plan.schema';
import { Exercise, ExerciseDocument } from '../../schemas/exercise.schema';
import {
  CreateWorkoutPlanDto,
  CreateExerciseConfigDto,
} from './dto/create-workout-plan.dto';
import { WeightUnit } from '../../common/enums/weight-unit.enum';
import { UpdateWorkoutPlanDto } from './dto/update-workout-plan.dto';
import {
  WorkoutPlanResponseDto,
  WorkoutPlanSummaryDto,
  PlanDayResponseDto,
  ExerciseConfigResponseDto,
} from './dto/workout-plan-response.dto';

const MAX_PLANS_PER_USER = 3;
const PLANS_CACHE_TTL = 120; // 2 minutes in seconds

@Injectable()
export class WorkoutPlansService {
  constructor(
    @InjectModel(WorkoutPlan.name)
    private readonly workoutPlanModel: Model<WorkoutPlanDocument>,
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async invalidatePlanCache(userId: string, planId?: string) {
    await Promise.all([
      this.cacheManager.del(`workout-plans:list:${userId}`),
      this.cacheManager.del(`workout-plans:active:${userId}`),
      ...(planId
        ? [this.cacheManager.del(`workout-plans:detail:${userId}:${planId}`)]
        : []),
    ]);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private toExerciseConfigResponse(
    config: ExerciseConfig,
  ): ExerciseConfigResponseDto {
    return {
      id: (config as unknown as { _id: Types.ObjectId })._id.toString(),
      exerciseId: config.exerciseId.toString(),
      exerciseName: config.exerciseName,
      sets: config.sets,
      reps: config.reps ?? null,
      duration: config.duration ?? null,
      weight: config.weight ?? null,
      weightUnit: config.weightUnit ?? WeightUnit.KG,
      bilateral: config.bilateral ?? true,
      left: config.left ?? null,
      right: config.right ?? null,
      rest: config.rest,
      notes: config.notes ?? null,
      supersetGroupId: config.supersetGroupId ?? null,
    };
  }

  private toPlanDayResponse(
    day: WorkoutPlanDocument['days'][number],
  ): PlanDayResponseDto {
    return {
      dayOfWeek: day.dayOfWeek,
      dayName: day.dayName ?? null,
      exercises: day.exercises.map((e) => this.toExerciseConfigResponse(e)),
    };
  }

  private toResponseDto(plan: WorkoutPlanDocument): WorkoutPlanResponseDto {
    return {
      id: plan._id.toString(),
      name: plan.name,
      isActive: plan.isActive,
      days: plan.days.map((d) => this.toPlanDayResponse(d)),
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  private toSummaryDto(plan: WorkoutPlanDocument): WorkoutPlanSummaryDto {
    return {
      id: plan._id.toString(),
      name: plan.name,
      isActive: plan.isActive,
      daysCount: plan.days.length,
      createdAt: plan.createdAt,
    };
  }

  // Resolves exerciseId → name + bilateral snapshot for each exercise config.
  // Throws NotFoundException if any exercise doesn't exist or is inactive.
  private async resolveExercises(configs: CreateExerciseConfigDto[]): Promise<
    {
      exerciseId: Types.ObjectId;
      exerciseName: string;
      bilateral: boolean;
    }[]
  > {
    const ids = configs.map((c) => new Types.ObjectId(c.exerciseId));
    const exercises = await this.exerciseModel
      .find({ _id: { $in: ids }, isActive: true })
      .select('_id name bilateral')
      .exec();

    const map = new Map(
      exercises.map((e) => [
        e._id.toString(),
        { name: e.name, bilateral: e.bilateral ?? true },
      ]),
    );

    for (const config of configs) {
      if (!map.has(config.exerciseId)) {
        throw new NotFoundException(
          `Exercise with id ${config.exerciseId} not found or is inactive`,
        );
      }
    }

    return configs.map((c) => ({
      exerciseId: new Types.ObjectId(c.exerciseId),
      exerciseName: map.get(c.exerciseId)!.name,
      bilateral: map.get(c.exerciseId)!.bilateral,
    }));
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  async findAll(userId: string): Promise<WorkoutPlanSummaryDto[]> {
    const key = `workout-plans:list:${userId}`;
    const cached = await this.cacheManager.get<WorkoutPlanSummaryDto[]>(key);
    if (cached) return cached;

    const plans = await this.workoutPlanModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    const result = plans.map((p) => this.toSummaryDto(p));
    await this.cacheManager.set(key, result, PLANS_CACHE_TTL);
    return result;
  }

  async findActive(userId: string): Promise<WorkoutPlanResponseDto> {
    const key = `workout-plans:active:${userId}`;
    const cached = await this.cacheManager.get<WorkoutPlanResponseDto>(key);
    if (cached) return cached;

    const plan = await this.workoutPlanModel
      .findOne({ userId: new Types.ObjectId(userId), isActive: true })
      .exec();

    if (!plan) {
      throw new NotFoundException('No active plan found');
    }

    const result = this.toResponseDto(plan);
    await this.cacheManager.set(key, result, PLANS_CACHE_TTL);
    return result;
  }

  async findById(id: string, userId: string): Promise<WorkoutPlanResponseDto> {
    const key = `workout-plans:detail:${userId}:${id}`;
    const cached = await this.cacheManager.get<WorkoutPlanResponseDto>(key);
    if (cached) return cached;

    const plan = await this.workoutPlanModel.findById(id).exec();

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.userId.toString() !== userId) {
      throw new ForbiddenException(
        'Plan does not belong to the authenticated user',
      );
    }

    const result = this.toResponseDto(plan);
    await this.cacheManager.set(key, result, PLANS_CACHE_TTL);
    return result;
  }

  // ─── Commands ────────────────────────────────────────────────────────────────

  async create(
    dto: CreateWorkoutPlanDto,
    userId: string,
  ): Promise<WorkoutPlanResponseDto> {
    const existingCount = await this.workoutPlanModel
      .countDocuments({ userId: new Types.ObjectId(userId) })
      .exec();

    if (existingCount >= MAX_PLANS_PER_USER) {
      throw new UnprocessableEntityException(
        'Maximum of 3 workout plans allowed per user',
      );
    }

    const days = await this.buildDays(dto.days ?? []);

    const plan = await this.workoutPlanModel.create({
      userId: new Types.ObjectId(userId),
      name: dto.name,
      days,
    });

    await this.invalidatePlanCache(userId);
    return this.toResponseDto(plan);
  }

  async update(
    id: string,
    dto: UpdateWorkoutPlanDto,
    userId: string,
  ): Promise<WorkoutPlanResponseDto> {
    const plan = await this.workoutPlanModel.findById(id).exec();

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.userId.toString() !== userId) {
      throw new ForbiddenException(
        'Plan does not belong to the authenticated user',
      );
    }

    if (dto.name !== undefined) {
      plan.name = dto.name;
    }

    if (dto.days !== undefined) {
      // Full replacement of the days array — client is the source of truth
      plan.days = await this.buildDays(dto.days);
    }

    await plan.save();

    await this.invalidatePlanCache(userId, id);
    return this.toResponseDto(plan);
  }

  async delete(id: string, userId: string): Promise<{ message: string }> {
    const plan = await this.workoutPlanModel.findById(id).exec();

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.userId.toString() !== userId) {
      throw new ForbiddenException(
        'Plan does not belong to the authenticated user',
      );
    }

    await this.workoutPlanModel.findByIdAndDelete(id).exec();

    await this.invalidatePlanCache(userId, id);
    return { message: 'Plan deleted successfully' };
  }

  async activate(
    id: string,
    userId: string,
  ): Promise<{ message: string; activePlanId: string }> {
    const plan = await this.workoutPlanModel.findById(id).exec();

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.userId.toString() !== userId) {
      throw new ForbiddenException(
        'Plan does not belong to the authenticated user',
      );
    }

    // Step 1 — deactivate all plans for this user
    await this.workoutPlanModel
      .updateMany(
        { userId: new Types.ObjectId(userId), isActive: true },
        { $set: { isActive: false } },
      )
      .exec();

    // Step 2 — activate the target plan
    await this.workoutPlanModel
      .findByIdAndUpdate(id, { $set: { isActive: true } })
      .exec();

    await this.invalidatePlanCache(userId, id);
    return {
      message: 'Plan activated successfully',
      activePlanId: id,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async buildDays(
    daysDto: CreateWorkoutPlanDto['days'],
  ): Promise<WorkoutPlanDocument['days']> {
    if (!daysDto || daysDto.length === 0) return [];

    const allExerciseConfigs = daysDto.flatMap((d) => d.exercises ?? []);

    // Resolve catalog data (name + bilateral) only when there are exercises.
    // Position-based map handles duplicate exerciseIds across days.
    const resolutions: Map<string, { name: string; bilateral: boolean }> =
      new Map();
    if (allExerciseConfigs.length > 0) {
      const resolved = await this.resolveExercises(allExerciseConfigs);
      resolved.forEach((r, i) => {
        resolutions.set(`${i}:${r.exerciseId.toString()}`, {
          name: r.exerciseName,
          bilateral: r.bilateral,
        });
      });
    }

    let globalIndex = 0;

    return daysDto.map((dayDto) => ({
      dayOfWeek: dayDto.dayOfWeek,
      dayName: dayDto.dayName,
      exercises: (dayDto.exercises ?? []).map((exerciseDto) => {
        const key = `${globalIndex}:${exerciseDto.exerciseId}`;
        const resolved = resolutions.get(key);
        const exerciseName = resolved?.name ?? '';
        const bilateral = resolved?.bilateral ?? true;
        globalIndex++;

        if (!bilateral) {
          // Unilateral: both sides required, each must carry reps OR duration.
          if (!exerciseDto.left || !exerciseDto.right) {
            throw new BadRequestException(
              `Exercise ${exerciseDto.exerciseId} is unilateral; both 'left' and 'right' are required.`,
            );
          }
          if (
            !this.isPlanSidePopulated(exerciseDto.left) ||
            !this.isPlanSidePopulated(exerciseDto.right)
          ) {
            throw new BadRequestException(
              `Exercise ${exerciseDto.exerciseId} is unilateral; each side must include reps or duration.`,
            );
          }
        }

        return {
          exerciseId: new Types.ObjectId(exerciseDto.exerciseId),
          exerciseName,
          bilateral,
          sets: exerciseDto.sets,
          reps: bilateral ? exerciseDto.reps : undefined,
          duration: bilateral ? exerciseDto.duration : undefined,
          weight: bilateral ? exerciseDto.weight : undefined,
          weightUnit: exerciseDto.weightUnit ?? WeightUnit.KG,
          left: bilateral ? undefined : exerciseDto.left,
          right: bilateral ? undefined : exerciseDto.right,
          rest: exerciseDto.rest,
          notes: exerciseDto.notes,
          supersetGroupId: exerciseDto.supersetGroupId,
        };
      }),
    })) as WorkoutPlanDocument['days'];
  }

  private isPlanSidePopulated(side: {
    reps?: number;
    duration?: number;
  }): boolean {
    return side.reps != null || side.duration != null;
  }
}
