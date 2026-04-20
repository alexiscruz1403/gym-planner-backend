import { ApiProperty } from '@nestjs/swagger';

export class FollowActionResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({
    description:
      'True when a follow request was queued (target has a private profile)',
  })
  pending: boolean;
}
