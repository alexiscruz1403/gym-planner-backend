import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { Exercise, ExerciseDocument } from '../../schemas/exercise.schema';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { ExerciseQueryDto } from './dto/exercise-query.dto';
import {
  ExerciseResponseDto,
  ExerciseListResponseDto,
} from './dto/exercise-response.dto';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

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

    return { message: 'Exercise deactivated successfully' };
  }
}
