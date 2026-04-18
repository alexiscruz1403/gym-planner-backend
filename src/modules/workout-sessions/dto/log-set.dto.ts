import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExerciseSideDto } from '../../../common/dto/exercise-side.dto';

export class LogSetDto {
  @ApiProperty({ description: 'Exercise ID as it appears in the session' })
  @IsMongoId()
  exerciseId: string;

  @ApiProperty({
    description: '0-based index of the set being logged',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  setIndex: number;

  @ApiPropertyOptional({
    description: 'Repetitions performed. Required for reps-based exercises.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  reps?: number;

  @ApiPropertyOptional({
    description: 'Duration in seconds. Required for timed exercises.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({
    description: 'Weight in kg. Omit for bodyweight exercises.',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({
    type: ExerciseSideDto,
    description:
      'Per-side actuals. Required for unilateral exercises (snapshot `bilateral: false`); ignored otherwise. Both `left` and `right` must be present to mark the set as completed.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExerciseSideDto)
  left?: ExerciseSideDto;

  @ApiPropertyOptional({
    type: ExerciseSideDto,
    description:
      'Per-side actuals. Required for unilateral exercises (snapshot `bilateral: false`); ignored otherwise. Both `left` and `right` must be present to mark the set as completed.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExerciseSideDto)
  right?: ExerciseSideDto;

  @ApiProperty({ description: 'Whether the set was successfully completed' })
  @IsBoolean()
  @IsNotEmpty()
  completed: boolean;
}
