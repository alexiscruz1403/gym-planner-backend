import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'The refresh token obtained from login or register',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
