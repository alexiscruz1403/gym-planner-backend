import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { MuscleGroup } from '../../../common/enums/muscle-group.enum';

export class LeaderboardQueryDto {
  @IsOptional()
  @IsEnum(MuscleGroup)
  muscle?: MuscleGroup;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
