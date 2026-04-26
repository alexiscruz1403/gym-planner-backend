import { MuscleGroup } from '../../../common/enums/muscle-group.enum';

export class ExerciseRankDetailDto {
  exerciseId: string;
  exerciseName: string;
  rank: number;
  rankName: string;
  bestValue: number;
  updatedAt: Date;
}

export class MuscleRankEntryDto {
  muscle: MuscleGroup;
  rank: number;
  rankName: string;
  exercises: ExerciseRankDetailDto[];
}
