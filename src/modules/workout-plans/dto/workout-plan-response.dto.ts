import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}

export class PlanDayResponseDto {
  @ApiProperty()
  dayOfWeek: string;

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
