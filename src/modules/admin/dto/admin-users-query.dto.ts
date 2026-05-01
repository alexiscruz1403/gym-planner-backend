import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipTier } from '../../../common/enums/membership-tier.enum';

export class AdminUsersQueryDto {
  @ApiPropertyOptional({ description: 'Filter by username (partial match)' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    enum: ['user', 'admin'],
    description: 'Filter by role',
  })
  @IsOptional()
  @IsEnum(['user', 'admin'])
  role?: 'user' | 'admin';

  @ApiPropertyOptional({
    enum: MembershipTier,
    description: 'Filter by membership tier',
  })
  @IsOptional()
  @IsEnum(MembershipTier)
  membershipTier?: MembershipTier;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
