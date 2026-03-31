import { ApiProperty } from '@nestjs/swagger';

export class PublicUserResponseDto {
  @ApiProperty({ example: '661f1b2c3d4e5f6a7b8c9d0e' })
  _id: string;

  @ApiProperty({ example: 'miusuario' })
  username: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/gym-planner/image/upload/avatars/abc123.jpg',
    required: false,
    nullable: true,
  })
  avatar?: string;

  @ApiProperty({ example: 12 })
  followersCount: number;

  @ApiProperty({ example: 7 })
  followingCount: number;

  @ApiProperty({
    example: false,
    description: 'True if the requesting user follows this profile',
  })
  isFollowing: boolean;
}
