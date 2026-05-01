import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlan } from '../../../common/enums/subscription-plan.enum';

export class MembershipAuditResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty({ description: 'ID of the admin who performed the action' })
  adminId: string;

  @ApiProperty({ description: 'ID of the user whose membership was changed' })
  targetUserId: string;

  @ApiProperty({ enum: ['gift', 'revoke'] })
  action: 'gift' | 'revoke';

  @ApiPropertyOptional({ enum: SubscriptionPlan, nullable: true })
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({ nullable: true })
  reason?: string;

  @ApiProperty()
  createdAt: Date;
}
