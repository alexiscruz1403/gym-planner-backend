import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleAutoRenewDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  autoRenew: boolean;
}
