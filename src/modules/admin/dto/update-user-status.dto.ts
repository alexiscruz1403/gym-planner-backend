import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'Set to false to deactivate the user' })
  @IsBoolean()
  isActive: boolean;
}
