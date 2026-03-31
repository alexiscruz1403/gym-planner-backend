import { ApiProperty } from '@nestjs/swagger';

export class FollowUserResponseDto {
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

  @ApiProperty({ example: false })
  isFollowing: boolean;
}

export class FollowListResponseDto {
  @ApiProperty({ type: [FollowUserResponseDto] })
  data: FollowUserResponseDto[];

  @ApiProperty({
    example: { total: 45, page: 1, limit: 20, totalPages: 3 },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
