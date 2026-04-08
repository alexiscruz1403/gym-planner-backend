import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  // Tokens are set as httpOnly cookies — not returned in the response body.
  // These fields are internal-only, used by the controller to read token values.
  accessToken: string;
  refreshToken: string;

  @ApiProperty({ type: () => UserResponseDto })
  user: UserResponseDto;
}
