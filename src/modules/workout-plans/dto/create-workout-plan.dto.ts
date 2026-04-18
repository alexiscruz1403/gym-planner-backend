import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
  Min,
  ArrayUnique,
  IsMongoId,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '../../../common/enums/day-of-week.enum';
import { WeightUnit } from '../../../common/enums/weight-unit.enum';
import { ExerciseSideDto } from '../../../common/dto/exercise-side.dto';

export class CreateExerciseConfigDto {
  @ApiProperty({ description: 'Exercise ID from the catalog' })
  @IsMongoId()
  exerciseId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  sets: number;

  @ApiPropertyOptional({
    description:
      'Number of repetitions. Required if duration is absent and the exercise is bilateral. Ignored when left/right are provided (unilateral).',
  })
  @ValidateIf(
    (o: CreateExerciseConfigDto) => !o.duration && !o.left && !o.right,
  )
  @IsInt()
  @Min(1)
  reps?: number;

  @ApiPropertyOptional({
    description:
      'Duration in seconds. Required if reps is absent and the exercise is bilateral. Ignored when left/right are provided (unilateral).',
  })
  @ValidateIf((o: CreateExerciseConfigDto) => !o.reps && !o.left && !o.right)
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({
    description: 'Weight in kg. Optional for bodyweight exercises.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({
    enum: WeightUnit,
    default: WeightUnit.KG,
    description: 'Unit of measurement for the weight field. Defaults to kg.',
  })
  @IsOptional()
  @IsEnum(WeightUnit)
  weightUnit?: WeightUnit;

  @ApiPropertyOptional({
    type: ExerciseSideDto,
    description:
      'Per-side planned target. Required for unilateral exercises (catalog `bilateral: false`); ignored otherwise.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExerciseSideDto)
  left?: ExerciseSideDto;

  @ApiPropertyOptional({
    type: ExerciseSideDto,
    description:
      'Per-side planned target. Required for unilateral exercises (catalog `bilateral: false`); ignored otherwise.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExerciseSideDto)
  right?: ExerciseSideDto;

  @ApiProperty({ description: 'Rest between sets in seconds', minimum: 0 })
  @IsInt()
  @Min(0)
  rest: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Identifier shared between exercises that form a superset. Any short string is valid (e.g. "A", "B", "push").',
    example: 'A',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  supersetGroupId?: string;
}

export class CreatePlanDayDto {
  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiPropertyOptional({
    description: 'Optional custom label for this day (e.g., "Push", "Legs A")',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dayName?: string;

  @ApiPropertyOptional({ type: [CreateExerciseConfigDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseConfigDto)
  exercises?: CreateExerciseConfigDto[];
}

export class CreateWorkoutPlanDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ type: [CreatePlanDayDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((day: CreatePlanDayDto) => day.dayOfWeek)
  @ValidateNested({ each: true })
  @Type(() => CreatePlanDayDto)
  days?: CreatePlanDayDto[];
}
