import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';

export type AdminMembershipAuditDocument =
  HydratedDocument<AdminMembershipAudit>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AdminMembershipAudit {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  adminId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  targetUserId: Types.ObjectId;

  @Prop({ type: String, enum: ['gift', 'revoke'], required: true })
  action: 'gift' | 'revoke';

  @Prop({
    type: String,
    enum: Object.values(SubscriptionPlan),
    required: false,
  })
  plan?: SubscriptionPlan;

  @Prop({ required: false })
  reason?: string;

  @Prop({ type: Date })
  createdAt: Date;
}

export const AdminMembershipAuditSchema =
  SchemaFactory.createForClass(AdminMembershipAudit);

AdminMembershipAuditSchema.index({ adminId: 1, createdAt: -1 });
AdminMembershipAuditSchema.index({ targetUserId: 1, createdAt: -1 });
