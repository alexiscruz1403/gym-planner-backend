import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['user', 'admin'] })
  @IsEnum(['user', 'admin'])
  role: 'user' | 'admin';
}
