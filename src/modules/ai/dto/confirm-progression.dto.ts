import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsMongoId } from 'class-validator';

export class ConfirmProgressionDto {
  @ApiProperty({ description: 'ID of the pending progression log' })
  @IsMongoId()
  logId: string;

  @ApiProperty({
    description: 'true to apply the proposed changes, false to reject them',
  })
  @IsBoolean()
  apply: boolean;
}
