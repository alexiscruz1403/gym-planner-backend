import { ApiProperty } from '@nestjs/swagger';

export class NotificationPreferencesResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({
    description: 'Receive notifications when someone follows you',
  })
  allowFollow: boolean;

  @ApiProperty({
    description:
      'Receive notifications for new follow requests (private profiles)',
  })
  allowFollowRequest: boolean;

  @ApiProperty({
    description: 'Receive notifications when someone likes your post',
  })
  allowPostLike: boolean;

  @ApiProperty({
    description: 'Receive notifications when someone comments on your post',
  })
  allowPostComment: boolean;

  @ApiProperty({
    description: 'Receive notifications when someone you follow creates a post',
  })
  allowNewPost: boolean;
}
