import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus, MembershipTier } from 'src/common/enums';

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
  membershipTier: MembershipTier;

  @ApiProperty()
  membershipStatus: MembershipStatus;

  @ApiProperty()
  createdAt: Date;
}
