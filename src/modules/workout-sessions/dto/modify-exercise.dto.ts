import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WeightUnit } from '../../../common/enums/weight-unit.enum';

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
}
