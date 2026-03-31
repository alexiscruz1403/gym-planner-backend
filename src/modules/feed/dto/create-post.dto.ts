import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ description: 'ID of the completed or partial WorkoutSession' })
  @IsMongoId()
  sessionId: string;

  @ApiPropertyOptional({ description: 'Optional caption (max 500 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}
