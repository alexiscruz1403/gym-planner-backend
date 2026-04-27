import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExerciseRankResponseDto {
  @ApiProperty()
  exerciseId: string;

  @ApiPropertyOptional({ nullable: true })
  exerciseName: string | null;

  @ApiPropertyOptional({ nullable: true })
  rank: number | null;

  @ApiPropertyOptional({ nullable: true })
  rankName: string | null;

  @ApiPropertyOptional({ nullable: true })
  bestValue: number | null;

  @ApiPropertyOptional({ nullable: true })
  updatedAt: Date | null;
}
