import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Exercise, ExerciseDocument } from '../../schemas/exercise.schema';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { ExerciseQueryDto } from './dto/exercise-query.dto';
import {
  ExerciseResponseDto,
  ExerciseListResponseDto,
  ExerciseWeightGuideDto,
} from './dto/exercise-response.dto';
import { WeightInstruction } from '../../common/enums/weight-instruction.enum';
import { LoadType } from 'src/common/enums';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private buildWeightGuide(
    loadType: LoadType,
    bilateral: boolean,
  ): ExerciseWeightGuideDto {
    if (loadType === LoadType.BARBELL)
      return {
        instruction: WeightInstruction.BARBELL_SUM,
        note: 'Log total bar weight: bar + plates on both sides',
      };
    if (loadType === LoadType.MACHINE)
      return bilateral
        ? {
            instruction: WeightInstruction.MACHINE_DISPLAY,
            note: 'Log what the machine weight stack or display shows',
          }
        : {
            instruction: WeightInstruction.MACHINE_SUM_SIDES,
            note: 'Log total: sum both sides of the machine',
          };
    if (loadType === LoadType.BODYWEIGHT)
      return {
        instruction: WeightInstruction.BODYWEIGHT,
        note: 'Log your current body weight',
      };
    if (loadType === LoadType.RESISTANCE_BAND)
      return { instruction: WeightInstruction.NO_WEIGHT, note: null };
    if (loadType === LoadType.CABLE)
      return bilateral
        ? {
            instruction: WeightInstruction.CABLE_DISPLAY,
            note: 'Log what the cable pulley weight display shows',
          }
        : {
            instruction: WeightInstruction.CABLE_SUM_SIDES,
            note: 'Log total: sum both cable sides',
          };
    // DUMBBELL and KETTLEBELL — bilateral flag is irrelevant
    return {
      instruction: WeightInstruction.EACH_SIDE_WEIGHT,
      note: 'Log the weight of each individual dumbbell/kettlebell',
    };
  }

  private toResponseDto(exercise: ExerciseDocument): ExerciseResponseDto {
    return {
      id: exercise._id.toString(),
      name: exercise.name,
      musclesPrimary: exercise.musclesPrimary,
      musclesSecondary: exercise.musclesSecondary,
      loadType: exercise.loadType,
      trackingType: exercise.trackingType,
      bilateral: exercise.bilateral,
      gifUrl: exercise.gifUrl ?? null,
      videoUrl: exercise.videoUrl ?? null,
      createdAt: exercise.createdAt,
      weightGuide: this.buildWeightGuide(exercise.loadType, exercise.bilateral),
    };
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  async findAll(query: ExerciseQueryDto): Promise<ExerciseListResponseDto> {
    const { search, muscle, loadType, page = 1, limit = 20 } = query;

    const filter: QueryFilter<ExerciseDocument> = { isActive: true };

    if (search) {
      filter.$text = { $search: search };
    }

    if (muscle) {
      filter.musclesPrimary = muscle;
    }

    if (loadType) {
      filter.loadType = loadType;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.exerciseModel.find(filter).skip(skip).limit(limit).exec(),
      this.exerciseModel.countDocuments(filter).exec(),
    ]);

    return {
      data: data.map((e) => this.toResponseDto(e)),
      total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<ExerciseResponseDto> {
    const exercise = await this.exerciseModel
      .findOne({ _id: id, isActive: true })
      .exec();

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    return this.toResponseDto(exercise);
  }

  // ─── Commands ────────────────────────────────────────────────────────────────

  async create(dto: CreateExerciseDto): Promise<ExerciseResponseDto> {
    const existing = await this.exerciseModel
      .findOne({ name: dto.name, isActive: true })
      .exec();

    if (existing) {
      throw new ConflictException('Exercise with this name already exists');
    }

    const exercise = await this.exerciseModel.create({
      ...dto,
      musclesSecondary: dto.musclesSecondary ?? [],
    });

    await this.cacheManager.clear();
    return this.toResponseDto(exercise);
  }

  async update(
    id: string,
    dto: UpdateExerciseDto,
  ): Promise<ExerciseResponseDto> {
    const exercise = await this.exerciseModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { $set: dto },
        { new: true },
      )
      .exec();

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    await this.cacheManager.clear();
    return this.toResponseDto(exercise);
  }

  async deactivate(id: string): Promise<{ message: string }> {
    const exercise = await this.exerciseModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { $set: { isActive: false } },
        { new: true },
      )
      .exec();

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    await this.cacheManager.clear();
    return { message: 'Exercise deactivated successfully' };
  }
}
