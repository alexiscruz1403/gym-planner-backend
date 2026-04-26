import { IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { MuscleGroup } from '../../../common/enums/muscle-group.enum';

export class MuscleRankQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',')
        : [],
  )
  @IsEnum(MuscleGroup, { each: true })
  muscle?: MuscleGroup[];
}
