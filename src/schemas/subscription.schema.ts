import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  preapprovalId: string;

  @Prop({ type: String, enum: Object.values(SubscriptionPlan), required: true })
  plan: SubscriptionPlan;

  @Prop({
    type: String,
    enum: Object.values(SubscriptionStatus),
    default: SubscriptionStatus.PENDING,
  })
  status: SubscriptionStatus;

  @Prop({ required: true })
  amountArs: number;

  // Unique human-readable order number for receipts: SUB-<base36ts>-<rand4>
  @Prop({ required: true, unique: true })
  orderNumber: string;

  @Prop({ type: Date, required: false })
  nextBillingDate?: Date;

  @Prop({ type: Date, required: false })
  lastPaymentDate?: Date;

  @Prop({ type: Date, required: false })
  cancelledAt?: Date;

  @Prop({ default: 0 })
  failureCount: number;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ nextBillingDate: 1 });
