import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeightUnit } from '../../../common/enums/weight-unit.enum';
import { ExerciseSideDto } from '../../../common/dto/exercise-side.dto';

export class ReplaceExerciseDto {
  @ApiProperty({
    description: 'ID of the new exercise from the catalog',
  })
  @IsMongoId()
  newExerciseId: string;

  @ApiPropertyOptional({
    description: 'Target sets for the new exercise',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedSets?: number;

  @ApiPropertyOptional({ description: 'Target repetitions', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedReps?: number;

  @ApiPropertyOptional({
    description: 'Target duration in seconds',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedDuration?: number;

  @ApiPropertyOptional({ description: 'Target weight in kg', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedWeight?: number;

  @ApiPropertyOptional({
    description: 'Rest time between sets in seconds',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  plannedRest?: number;

  @ApiPropertyOptional({
    enum: WeightUnit,
    description:
      'Weight unit for the replacement exercise. Defaults to kg — never inherited from the original.',
  })
  @IsOptional()
  @IsEnum(WeightUnit)
  weightUnit?: WeightUnit;

  @ApiPropertyOptional({
    type: ExerciseSideDto,
    description:
      'Per-side planned target for the replacement. Required if the new exercise is unilateral.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExerciseSideDto)
  plannedLeft?: ExerciseSideDto;

  @ApiPropertyOptional({
    type: ExerciseSideDto,
    description:
      'Per-side planned target for the replacement. Required if the new exercise is unilateral.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExerciseSideDto)
  plannedRight?: ExerciseSideDto;
}
