import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExerciseSideDto } from '../../../common/dto/exercise-side.dto';

export class ExerciseConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  exerciseId: string;

  @ApiProperty()
  exerciseName: string;

  @ApiProperty()
  sets: number;

  @ApiPropertyOptional({ nullable: true })
  reps: number | null;

  @ApiPropertyOptional({ nullable: true })
  duration: number | null;

  @ApiPropertyOptional({ nullable: true })
  weight: number | null;

  @ApiProperty()
  rest: number;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ nullable: true })
  supersetGroupId: string | null;

  @ApiProperty()
  weightUnit: string;

  @ApiProperty()
  bilateral: boolean;

  @ApiPropertyOptional({ type: ExerciseSideDto, nullable: true })
  left: ExerciseSideDto | null;

  @ApiPropertyOptional({ type: ExerciseSideDto, nullable: true })
  right: ExerciseSideDto | null;
}

export class PlanDayResponseDto {
  @ApiProperty()
  dayOfWeek: string;

  @ApiPropertyOptional({ nullable: true })
  dayName: string | null;

  @ApiProperty({ type: [ExerciseConfigResponseDto] })
  exercises: ExerciseConfigResponseDto[];
}

export class WorkoutPlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: [PlanDayResponseDto] })
  days: PlanDayResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class WorkoutPlanSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  daysCount: number;

  @ApiProperty()
  createdAt: Date;
}
