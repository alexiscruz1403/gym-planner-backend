import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '661f1b2c3d4e5f6a7b8c9d0e' })
  id: string;

  @ApiProperty({ example: 'usuario@email.com' })
  email: string;

  @ApiProperty({ example: 'miusuario' })
  username: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/gym-planner/image/upload/avatars/abc123.jpg',
    required: false,
    nullable: true,
  })
  avatar?: string;

  @ApiProperty({ example: 0 })
  followersCount: number;

  @ApiProperty({ example: 0 })
  followingCount: number;

  @ApiProperty({ enum: ['user', 'admin'], example: 'user' })
  role: 'user' | 'admin';

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true })
  isPrivate: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;
}
