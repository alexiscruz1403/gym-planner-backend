import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WeightUnit } from '../../../common/enums/weight-unit.enum';
import { ExerciseSideDto } from '../../../common/dto/exercise-side.dto';

export class ModifyExerciseDto {
  @ApiPropertyOptional({ description: 'New target number of sets', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedSets?: number;

  @ApiPropertyOptional({ description: 'New target repetitions', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedReps?: number;

  @ApiPropertyOptional({
    description: 'New target duration in seconds',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedDuration?: number;

  @ApiPropertyOptional({ description: 'New target weight in kg', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedWeight?: number;

  @ApiPropertyOptional({
    description: 'New rest time between sets in seconds',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  plannedRest?: number;

  @ApiPropertyOptional({
    enum: WeightUnit,
    description: 'New weight unit for this exercise within the session.',
  })
  @IsOptional()
  @IsEnum(WeightUnit)
  weightUnit?: WeightUnit;

  @ApiPropertyOptional({
    type: ExerciseSideDto,
    description:
      'New per-side planned target. Only honored for unilateral exercises.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExerciseSideDto)
  plannedLeft?: ExerciseSideDto;

  @ApiPropertyOptional({
    type: ExerciseSideDto,
    description:
      'New per-side planned target. Only honored for unilateral exercises.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExerciseSideDto)
  plannedRight?: ExerciseSideDto;
}
