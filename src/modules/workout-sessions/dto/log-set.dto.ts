import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogSetDto {
  @ApiProperty({ description: 'Exercise ID as it appears in the session' })
  @IsMongoId()
  exerciseId: string;

  @ApiProperty({
    description: '0-based index of the set being logged',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  setIndex: number;

  @ApiPropertyOptional({
    description: 'Repetitions performed. Required for reps-based exercises.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  reps?: number;

  @ApiPropertyOptional({
    description: 'Duration in seconds. Required for timed exercises.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({
    description: 'Weight in kg. Omit for bodyweight exercises.',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiProperty({ description: 'Whether the set was successfully completed' })
  @IsBoolean()
  @IsNotEmpty()
  completed: boolean;
}
