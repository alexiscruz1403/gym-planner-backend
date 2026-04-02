import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUserResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  avatar: string | undefined;

  @ApiProperty({ enum: ['user', 'admin'] })
  role: 'user' | 'admin';

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  followersCount: number;

  @ApiProperty()
  followingCount: number;

  @ApiProperty()
  createdAt: Date;
}
