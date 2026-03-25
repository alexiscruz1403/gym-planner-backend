import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  @ApiProperty({
    description:
      'Short-lived JWT access token (15 min). Send in Authorization: Bearer header.',
  })
  accessToken: string;

  @ApiProperty({
    description:
      'Long-lived refresh token (7 days). Use to obtain a new access token.',
  })
  refreshToken: string;

  @ApiProperty({ type: () => UserResponseDto })
  user: UserResponseDto;
}
