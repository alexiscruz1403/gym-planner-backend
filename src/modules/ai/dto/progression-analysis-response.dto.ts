import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressionChangeType } from '../../../common/enums';

export class ExerciseChangeResponseDto {
  @ApiProperty()
  exerciseId: string;

  @ApiProperty()
  exerciseName: string;

  @ApiProperty({ enum: ProgressionChangeType })
  changeType: ProgressionChangeType;

  @ApiPropertyOptional({ nullable: true })
  previousWeight: number | null;

  @ApiPropertyOptional({ nullable: true })
  newWeight: number | null;

  @ApiPropertyOptional({ nullable: true })
  previousLeftWeight: number | null;

  @ApiPropertyOptional({ nullable: true })
  newLeftWeight: number | null;

  @ApiPropertyOptional({ nullable: true })
  previousRightWeight: number | null;

  @ApiPropertyOptional({ nullable: true })
  newRightWeight: number | null;

  @ApiPropertyOptional({ nullable: true })
  previousSets: number | null;

  @ApiPropertyOptional({ nullable: true })
  newSets: number | null;

  @ApiPropertyOptional({ nullable: true })
  previousReps: number | null;

  @ApiPropertyOptional({ nullable: true })
  newReps: number | null;

  @ApiProperty()
  reasoning: string;
}

export class ProgressionAnalysisResponseDto {
  @ApiProperty()
  logId: string;

  @ApiProperty()
  planId: string;

  @ApiProperty()
  isDeloadWeek: boolean;

  @ApiProperty({ enum: ['pending', 'applied', 'rejected', 'failed'] })
  status: 'pending' | 'applied' | 'rejected' | 'failed';

  @ApiProperty({ type: [ExerciseChangeResponseDto] })
  changesApplied: ExerciseChangeResponseDto[];

  @ApiProperty()
  message: string;
}
