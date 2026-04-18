import { ApiProperty } from '@nestjs/swagger';

export class WsTokenResponseDto {
  @ApiProperty({
    description:
      'Short-lived JWT (60s) to pass as `auth: { token }` in the Socket.IO handshake.',
  })
  token: string;

  @ApiProperty({ description: 'Absolute UTC expiry of the token.' })
  expiresAt: Date;
}
