import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import {
  Subscription,
  SubscriptionDocument,
} from '../../schemas/subscription.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { MembershipTier } from '../../common/enums/membership-tier.enum';
import { MembershipStatus } from '../../common/enums/membership-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { ToggleAutoRenewDto } from './dto/toggle-auto-renew.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

interface PlanConfig {
  amount: number;
  frequencyMonths: number;
  label: string;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly mp: MercadoPagoConfig;

  private readonly PLANS: Record<SubscriptionPlan, PlanConfig> = {
    [SubscriptionPlan.MONTHLY]: {
      amount: 100,
      frequencyMonths: 1,
      label: 'Mensual',
    },
    [SubscriptionPlan.ANNUAL]: {
      amount: 1000,
      frequencyMonths: 12,
      label: 'Anual',
    },
  };

  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    this.mp = new MercadoPagoConfig({
      accessToken:
        this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') ??
        'TEST-token',
    });
  }

  // ─── Checkout ──────────────────────────────────────────────────────────────

  async createCheckout(
    userId: string,
    dto: CreateCheckoutDto,
  ): Promise<CheckoutResponseDto> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    // Cancel any existing active preapproval before creating a new one
    const existing = await this.subscriptionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: SubscriptionStatus.AUTHORIZED,
      })
      .exec();

    if (existing) {
      await this.cancelPreapproval(existing.preapprovalId);
      existing.status = SubscriptionStatus.CANCELLED;
      existing.cancelledAt = new Date();
      await existing.save();
    }

    const planConfig = this.PLANS[dto.plan];

    // MercadoPago Preapprovals require back_url and reject localhost.
    // In local dev we fall back to a placeholder that satisfies validation.
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const isLocalhost = !frontendUrl || frontendUrl.includes('localhost');
    const backUrl = isLocalhost
      ? 'https://example.com/subscription/success'
      : `${frontendUrl}/subscription/success`;

    const preapprovalClient = new PreApproval(this.mp);

    const response = await preapprovalClient.create({
      body: {
        reason: `Gym Planner Premium — ${planConfig.label}`,
        auto_recurring: {
          frequency: planConfig.frequencyMonths,
          frequency_type: 'months',
          transaction_amount: planConfig.amount,
          currency_id: 'ARS',
        },
        back_url: backUrl,
        payer_email: user.email,
      },
    });

    const orderNumber = this.generateOrderNumber();

    await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      preapprovalId: response.id,
      plan: dto.plan,
      status: SubscriptionStatus.PENDING,
      amountArs: planConfig.amount,
      orderNumber,
    });

    return {
      initPoint: response.init_point!,
      preapprovalId: response.id!,
    };
  }

  // ─── Webhook ───────────────────────────────────────────────────────────────

  async handleWebhook(
    topic: string,
    id: string,
    rawSignature: string | undefined,
    rawBody: Buffer,
  ): Promise<void> {
    this.verifyWebhookSignature(rawSignature, rawBody);

    if (topic !== 'preapproval') return;

    const preapprovalClient = new PreApproval(this.mp);
    const preapproval = await preapprovalClient.get({ id });

    const subscription = await this.subscriptionModel
      .findOne({ preapprovalId: id })
      .exec();

    if (!subscription) {
      this.logger.warn(`Webhook received for unknown preapprovalId: ${id}`);
      return;
    }

    const user = await this.userModel.findById(subscription.userId).exec();
    if (!user) return;

    const mpStatus = preapproval.status;

    if (mpStatus === 'authorized') {
      await this.handlePaymentSuccess(subscription, user);
    } else if (mpStatus === 'cancelled' || mpStatus === 'paused') {
      await this.handlePaymentFailureOrCancel(subscription, user, mpStatus);
    }
  }

  // ─── Auto-renew toggle ─────────────────────────────────────────────────────

  async toggleAutoRenew(
    userId: string,
    dto: ToggleAutoRenewDto,
  ): Promise<{ autoRenew: boolean }> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { autoRenew: dto.autoRenew }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return { autoRenew: user.autoRenew };
  }

  // ─── Get current subscription ──────────────────────────────────────────────

  async getMySubscription(
    userId: string,
  ): Promise<SubscriptionResponseDto | null> {
    const sub = await this.subscriptionModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    if (!sub) return null;
    return this.toResponseDto(sub);
  }

  // ─── Cron — expire overdue memberships ────────────────────────────────────

  async expireOverdueMemberships(): Promise<void> {
    const now = new Date();
    const expired = await this.userModel
      .find({
        membershipTier: MembershipTier.PREMIUM,
        membershipStatus: MembershipStatus.ACTIVE,
        membershipExpiresAt: { $lt: now },
      })
      .exec();

    for (const user of expired) {
      await this.userModel
        .findByIdAndUpdate(user._id, {
          membershipTier: MembershipTier.FREE,
          membershipStatus: MembershipStatus.EXPIRED,
        })
        .exec();

      await this.notificationsService.createSystemNotificationForUser(
        user._id.toString(),
        'Tu Premium expiró',
        'Tu membresía Premium ha expirado. Renueva para seguir disfrutando de los beneficios.',
      );

      this.logger.log(`Expired membership for user ${user._id.toString()}`);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async handlePaymentSuccess(
    subscription: SubscriptionDocument,
    user: UserDocument,
  ): Promise<void> {
    const planConfig = this.PLANS[subscription.plan];

    const nextDate = this.computeNextBillingDate(planConfig.frequencyMonths);

    subscription.status = SubscriptionStatus.AUTHORIZED;
    subscription.lastPaymentDate = new Date();
    subscription.failureCount = 0;
    subscription.nextBillingDate = nextDate;
    await subscription.save();

    await this.userModel
      .findByIdAndUpdate(user._id, {
        membershipTier: MembershipTier.PREMIUM,
        membershipStatus: MembershipStatus.ACTIVE,
        membershipExpiresAt: nextDate,
      })
      .exec();

    await this.emailService.sendPaymentReceipt({
      username: user.username,
      email: user.email,
      orderNumber: subscription.orderNumber,
      plan: planConfig.label,
      amountArs: planConfig.amount,
      nextBillingDate: nextDate.toLocaleDateString('es-AR'),
    });

    await this.notificationsService.createSystemNotificationForUser(
      user._id.toString(),
      'Premium activado',
      `Tu suscripción Premium (${planConfig.label}) está activa. ¡Gracias por tu pago!`,
    );
  }

  private async handlePaymentFailureOrCancel(
    subscription: SubscriptionDocument,
    user: UserDocument,
    mpStatus: string,
  ): Promise<void> {
    const planConfig = this.PLANS[subscription.plan];
    const isCancel = mpStatus === 'cancelled';

    subscription.status = isCancel
      ? SubscriptionStatus.CANCELLED
      : SubscriptionStatus.PAYMENT_FAILED;
    subscription.failureCount += 1;
    if (isCancel) subscription.cancelledAt = new Date();
    await subscription.save();

    await this.userModel
      .findByIdAndUpdate(user._id, {
        membershipTier: MembershipTier.FREE,
        membershipStatus: MembershipStatus.EXPIRED,
      })
      .exec();

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    await this.emailService.sendRenewalFailure({
      username: user.username,
      email: user.email,
      plan: planConfig.label,
      supportUrl: `${frontendUrl}/settings/subscription`,
    });

    await this.notificationsService.createSystemNotificationForUser(
      user._id.toString(),
      'Error en renovación Premium',
      `No pudimos procesar el pago de tu suscripción ${planConfig.label}. Verificá tu método de pago en MercadoPago.`,
    );
  }

  private generateOrderNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SUB-${ts}-${rand}`;
  }

  private computeNextBillingDate(frequencyMonths: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + frequencyMonths);
    return d;
  }

  private async cancelPreapproval(preapprovalId: string): Promise<void> {
    try {
      const client = new PreApproval(this.mp);
      await client.update({ id: preapprovalId, body: { status: 'cancelled' } });
    } catch (err) {
      this.logger.error(
        `Failed to cancel preapproval ${preapprovalId}`,
        err as Error,
      );
    }
  }

  private verifyWebhookSignature(
    rawSignature: string | undefined,
    rawBody: Buffer,
  ): void {
    const secret = this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET');
    if (!secret) return; // Skip verification in local/test environments without a secret

    if (!rawSignature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    if (rawSignature !== expected) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private toResponseDto(sub: SubscriptionDocument): SubscriptionResponseDto {
    return {
      _id: sub._id.toString(),
      userId: sub.userId.toString(),
      preapprovalId: sub.preapprovalId,
      plan: sub.plan,
      status: sub.status,
      amountArs: sub.amountArs,
      orderNumber: sub.orderNumber,
      nextBillingDate: sub.nextBillingDate?.toISOString(),
      lastPaymentDate: sub.lastPaymentDate?.toISOString(),
      createdAt: sub.createdAt,
    };
  }
}
