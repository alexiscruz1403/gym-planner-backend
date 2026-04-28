import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '../../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../../common/enums/subscription-status.enum';

export class SubscriptionResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  preapprovalId: string;

  @ApiProperty({ enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiProperty()
  amountArs: number;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty({ required: false, nullable: true })
  nextBillingDate?: string;

  @ApiProperty({ required: false, nullable: true })
  lastPaymentDate?: string;

  @ApiProperty()
  createdAt: Date;
}
