import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  ArrayMinSize,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MuscleGroup } from '../../../common/enums/muscle-group.enum';
import { LoadType } from '../../../common/enums/load-type.enum';

export class CreateExerciseDto {
  @ApiProperty({ example: 'Barbell Back Squat', minLength: 3, maxLength: 100 })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    enum: MuscleGroup,
    isArray: true,
    example: ['quads', 'glutes'],
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(MuscleGroup, { each: true })
  musclesPrimary: MuscleGroup[];

  @ApiPropertyOptional({
    enum: MuscleGroup,
    isArray: true,
    example: ['hamstrings'],
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(MuscleGroup, { each: true })
  musclesSecondary?: MuscleGroup[];

  @ApiProperty({ enum: LoadType, example: LoadType.BARBELL })
  @IsEnum(LoadType)
  loadType: LoadType;

  @ApiProperty({ enum: ['reps', 'duration'], example: 'reps' })
  @IsEnum(['reps', 'duration'])
  trackingType: 'reps' | 'duration';

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  bilateral: boolean;

  @ApiProperty()
  @IsOptional()
  gifUrl?: string;

  @ApiProperty()
  @IsOptional()
  videoUrl?: string;
}
