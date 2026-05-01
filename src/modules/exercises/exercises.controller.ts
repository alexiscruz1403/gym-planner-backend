import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  UploadedFiles,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { ExerciseQueryDto } from './dto/exercise-query.dto';
import {
  ExerciseResponseDto,
  ExerciseListResponseDto,
} from './dto/exercise-response.dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { UploadService } from '../users/upload.service';

@ApiTags('Exercises')
@ApiBearerAuth('access-token')
@Controller('exercises')
export class ExercisesController {
  constructor(
    private readonly exercisesService: ExercisesService,
    private readonly uploadService: UploadService,
  ) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'List and search the exercise catalog' })
  @ApiResponse({ status: 200, type: ExerciseListResponseDto })
  findAll(@Query() query: ExerciseQueryDto): Promise<ExerciseListResponseDto> {
    return this.exercisesService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Get exercise detail by ID' })
  @ApiResponse({ status: 200, type: ExerciseResponseDto })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  findOne(@Param('id') id: string): Promise<ExerciseResponseDto> {
    return this.exercisesService.findById(id);
  }

  @Post()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Admin] Create a new exercise' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'name',
        'musclesPrimary',
        'loadType',
        'trackingType',
        'bilateral',
      ],
      properties: {
        name: { type: 'string' },
        musclesPrimary: { type: 'array', items: { type: 'string' } },
        musclesSecondary: { type: 'array', items: { type: 'string' } },
        loadType: { type: 'string' },
        trackingType: { type: 'string', enum: ['reps', 'duration'] },
        bilateral: { type: 'boolean' },
        gif: { type: 'string', format: 'binary' },
        video: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, type: ExerciseResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Exercise with this name already exists',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'gif', maxCount: 1 },
        { name: 'video', maxCount: 1 },
      ],
      { storage: undefined, limits: { fileSize: 50 * 1024 * 1024 } },
    ),
  )
  async create(
    @Body() dto: CreateExerciseDto,
    @UploadedFiles()
    files: { gif?: Express.Multer.File[]; video?: Express.Multer.File[] },
  ): Promise<ExerciseResponseDto> {
    if (files?.gif?.[0]) {
      dto.gifUrl = await this.uploadService.uploadImage(
        files.gif[0],
        'gym-planner/exercises/gifs',
      );
    }
    if (files?.video?.[0]) {
      dto.videoUrl = await this.uploadService.uploadVideo(
        files.video[0],
        'gym-planner/exercises/videos',
      );
    }
    return this.exercisesService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '[Admin] Update an exercise' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        musclesPrimary: { type: 'array', items: { type: 'string' } },
        musclesSecondary: { type: 'array', items: { type: 'string' } },
        loadType: { type: 'string' },
        trackingType: { type: 'string', enum: ['reps', 'duration'] },
        bilateral: { type: 'boolean' },
        gif: { type: 'string', format: 'binary' },
        video: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, type: ExerciseResponseDto })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'gif', maxCount: 1 },
        { name: 'video', maxCount: 1 },
      ],
      { storage: undefined, limits: { fileSize: 50 * 1024 * 1024 } },
    ),
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExerciseDto,
    @UploadedFiles()
    files: { gif?: Express.Multer.File[]; video?: Express.Multer.File[] },
  ): Promise<ExerciseResponseDto> {
    if (files?.gif?.[0]) {
      dto.gifUrl = await this.uploadService.uploadImage(
        files.gif[0],
        'gym-planner/exercises/gifs',
      );
    }
    if (files?.video?.[0]) {
      dto.videoUrl = await this.uploadService.uploadVideo(
        files.video[0],
        'gym-planner/exercises/videos',
      );
    }
    return this.exercisesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '[Admin] Deactivate an exercise (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Exercise deactivated successfully',
  })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  deactivate(@Param('id') id: string): Promise<{ message: string }> {
    return this.exercisesService.deactivate(id);
  }
}
