import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'nuevonombre',
    description: 'Between 3 and 20 characters',
    minLength: 3,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username?: string;

  @ApiPropertyOptional({
    description:
      'Set to true to make the profile private (follow requests required)',
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
