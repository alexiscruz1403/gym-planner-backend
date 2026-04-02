import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsUrl,
  IsArray,
  ArrayMinSize,
  MinLength,
  MaxLength,
} from 'class-validator';
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
  @IsBoolean()
  bilateral: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/squat.gif' })
  @IsOptional()
  @IsUrl()
  gifUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/squat.mp4' })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;
}
