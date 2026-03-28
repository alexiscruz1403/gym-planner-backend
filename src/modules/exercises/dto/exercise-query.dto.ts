import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MuscleGroup } from '../../../common/enums/muscle-group.enum';
import { LoadType } from '../../../common/enums/load-type.enum';

export class ExerciseQueryDto {
  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: MuscleGroup,
    description: 'Filter by primary muscle',
  })
  @IsOptional()
  @IsEnum(MuscleGroup)
  muscle?: MuscleGroup;

  @ApiPropertyOptional({ enum: LoadType, description: 'Filter by load type' })
  @IsOptional()
  @IsEnum(LoadType)
  loadType?: LoadType;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
