import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicUserResponseDto {
  @ApiProperty({ example: '661f1b2c3d4e5f6a7b8c9d0e' })
  _id: string;

  @ApiProperty({ example: 'miusuario' })
  username: string;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/gym-planner/image/upload/avatars/abc123.jpg',
    nullable: true,
  })
  avatar?: string;

  @ApiProperty({ description: 'True if the profile is set to private' })
  isPrivate: boolean;

  @ApiPropertyOptional({
    description:
      'Follower count — omitted when the profile is private and the requester is not an approved follower',
    nullable: true,
  })
  followersCount?: number;

  @ApiPropertyOptional({
    description:
      'Following count — omitted when the profile is private and the requester is not an approved follower',
    nullable: true,
  })
  followingCount?: number;

  @ApiProperty({
    example: false,
    description: 'True if the requesting user follows this profile',
  })
  isFollowing: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'True if the requesting user has a pending follow request to this profile',
  })
  isRequestPending?: boolean;
}
