import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevokeMembershipDto {
  @ApiProperty({
    description: 'Reason for revoking the premium membership',
    minLength: 1,
    maxLength: 500,
    example: 'Policy violation',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}
