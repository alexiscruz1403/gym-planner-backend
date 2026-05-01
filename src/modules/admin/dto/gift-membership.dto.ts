import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '../../../common/enums/subscription-plan.enum';

export class GiftMembershipDto {
  @ApiProperty({ enum: SubscriptionPlan, example: SubscriptionPlan.MONTHLY })
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;
}
