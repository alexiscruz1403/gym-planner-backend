import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
import { UpdateWorkoutPlanDto } from './dto/update-workout-plan.dto';
import {
  WorkoutPlanResponseDto,
  WorkoutPlanSummaryDto,
  PlanDayResponseDto,
  ExerciseConfigResponseDto,
} from './dto/workout-plan-response.dto';

const MAX_PLANS_PER_USER = 3;

@Injectable()
export class WorkoutPlansService {
  constructor(
    @InjectModel(WorkoutPlan.name)
    private readonly workoutPlanModel: Model<WorkoutPlanDocument>,
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
  ) {}

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

  // Resolves exerciseId → exerciseName snapshot for each exercise config.
  // Throws NotFoundException if any exercise doesn't exist or is inactive.
  private async resolveExerciseNames(
    configs: CreateExerciseConfigDto[],
  ): Promise<{ exerciseId: Types.ObjectId; exerciseName: string }[]> {
    const ids = configs.map((c) => new Types.ObjectId(c.exerciseId));
    const exercises = await this.exerciseModel
      .find({ _id: { $in: ids }, isActive: true })
      .select('_id name')
      .exec();

    const nameMap = new Map(exercises.map((e) => [e._id.toString(), e.name]));

    for (const config of configs) {
      if (!nameMap.has(config.exerciseId)) {
        throw new NotFoundException(
          `Exercise with id ${config.exerciseId} not found or is inactive`,
        );
      }
    }

    return configs.map((c) => ({
      exerciseId: new Types.ObjectId(c.exerciseId),
      exerciseName: nameMap.get(c.exerciseId)!,
    }));
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  async findAll(userId: string): Promise<WorkoutPlanSummaryDto[]> {
    const plans = await this.workoutPlanModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    return plans.map((p) => this.toSummaryDto(p));
  }

  async findActive(userId: string): Promise<WorkoutPlanResponseDto> {
    const plan = await this.workoutPlanModel
      .findOne({ userId: new Types.ObjectId(userId), isActive: true })
      .exec();

    if (!plan) {
      throw new NotFoundException('No active plan found');
    }

    return this.toResponseDto(plan);
  }

  async findById(id: string, userId: string): Promise<WorkoutPlanResponseDto> {
    const plan = await this.workoutPlanModel.findById(id).exec();

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.userId.toString() !== userId) {
      throw new ForbiddenException(
        'Plan does not belong to the authenticated user',
      );
    }

    return this.toResponseDto(plan);
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

    // Resolve names only when there are exercises to look up
    let nameResolutions: Map<string, string> = new Map();
    if (allExerciseConfigs.length > 0) {
      const resolved = await this.resolveExerciseNames(allExerciseConfigs);
      // Build a position-based map using index to handle duplicate exerciseIds
      resolved.forEach((r, i) => {
        nameResolutions.set(`${i}:${r.exerciseId.toString()}`, r.exerciseName);
      });
    }

    let globalIndex = 0;

    return daysDto.map((dayDto) => ({
      dayOfWeek: dayDto.dayOfWeek,
      exercises: (dayDto.exercises ?? []).map((exerciseDto) => {
        const key = `${globalIndex}:${exerciseDto.exerciseId}`;
        const exerciseName = nameResolutions.get(key) ?? '';
        globalIndex++;

        return {
          exerciseId: new Types.ObjectId(exerciseDto.exerciseId),
          exerciseName,
          sets: exerciseDto.sets,
          reps: exerciseDto.reps,
          duration: exerciseDto.duration,
          weight: exerciseDto.weight,
          rest: exerciseDto.rest,
          notes: exerciseDto.notes,
          supersetGroupId: exerciseDto.supersetGroupId,
        };
      }),
    })) as WorkoutPlanDocument['days'];
  }
}
