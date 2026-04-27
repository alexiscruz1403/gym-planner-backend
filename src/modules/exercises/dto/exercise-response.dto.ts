import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MuscleGroup } from '../../../common/enums/muscle-group.enum';
import { LoadType } from '../../../common/enums/load-type.enum';
import { WeightInstruction } from '../../../common/enums/weight-instruction.enum';

export class ExerciseWeightGuideDto {
  @ApiProperty({ enum: WeightInstruction })
  instruction: WeightInstruction;

  @ApiPropertyOptional({ nullable: true })
  note: string | null;
}

export class ExerciseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: MuscleGroup, isArray: true })
  musclesPrimary: MuscleGroup[];

  @ApiProperty({ enum: MuscleGroup, isArray: true })
  musclesSecondary: MuscleGroup[];

  @ApiProperty({ enum: LoadType })
  loadType: LoadType;

  @ApiProperty({ enum: ['reps', 'duration'] })
  trackingType: 'reps' | 'duration';

  @ApiProperty()
  bilateral: boolean;

  @ApiPropertyOptional({ nullable: true })
  gifUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  videoUrl: string | null;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiProperty({ type: ExerciseWeightGuideDto })
  weightGuide: ExerciseWeightGuideDto;
}

export class ExerciseListResponseDto {
  @ApiProperty({ type: [ExerciseResponseDto] })
  data: ExerciseResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
