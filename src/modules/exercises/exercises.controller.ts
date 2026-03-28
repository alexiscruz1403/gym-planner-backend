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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
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

@ApiTags('Exercises')
@ApiBearerAuth('access-token')
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({ summary: 'List and search the exercise catalog' })
  @ApiResponse({ status: 200, type: ExerciseListResponseDto })
  findAll(@Query() query: ExerciseQueryDto): Promise<ExerciseListResponseDto> {
    return this.exercisesService.findAll(query);
  }

  @Get(':id')
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
  @ApiResponse({ status: 201, type: ExerciseResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Exercise with this name already exists',
  })
  create(@Body() dto: CreateExerciseDto): Promise<ExerciseResponseDto> {
    return this.exercisesService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '[Admin] Update an exercise' })
  @ApiResponse({ status: 200, type: ExerciseResponseDto })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExerciseDto,
  ): Promise<ExerciseResponseDto> {
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
