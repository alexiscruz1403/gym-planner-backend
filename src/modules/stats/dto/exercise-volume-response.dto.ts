import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExerciseVolumeBreakdownItemDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  volume: number;

  @ApiProperty()
  sets: number;

  @ApiProperty()
  sessions: number;
}

export class ExerciseVolumeResponseDto {
  @ApiProperty()
  exerciseId: string;

  @ApiProperty({ enum: ['week', 'month', 'year'] })
  period: string;

  @ApiProperty()
  date: string;

  @ApiProperty()
  from: Date;

  @ApiProperty()
  to: Date;

  @ApiProperty()
  totalVolume: number;

  @ApiProperty()
  totalSets: number;

  @ApiProperty()
  totalSessions: number;

  @ApiProperty()
  hasLbsExercises: boolean;

  @ApiProperty({ type: [ExerciseVolumeBreakdownItemDto] })
  breakdown: ExerciseVolumeBreakdownItemDto[];

  @ApiProperty()
  previousTotalVolume: number;

  @ApiPropertyOptional({ nullable: true })
  changePercent: number | null;
}
