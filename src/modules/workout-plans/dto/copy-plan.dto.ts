import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CopyPlanDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Name for the copied plan',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
