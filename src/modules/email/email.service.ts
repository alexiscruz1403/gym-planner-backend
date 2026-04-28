import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export interface PaymentReceiptContext {
  username: string;
  email: string;
  orderNumber: string;
  plan: string;
  amountArs: number;
  nextBillingDate: string;
}

export interface RenewalFailureContext {
  username: string;
  email: string;
  plan: string;
  supportUrl: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailer: MailerService) {}

  async sendPaymentReceipt(ctx: PaymentReceiptContext): Promise<void> {
    try {
      await this.mailer.sendMail({
        to: ctx.email,
        subject: `Comprobante de pago — Orden ${ctx.orderNumber}`,
        template: 'payment-receipt',
        context: ctx,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send payment receipt to ${ctx.email}`,
        err as Error,
      );
    }
  }

  async sendRenewalFailure(ctx: RenewalFailureContext): Promise<void> {
    try {
      await this.mailer.sendMail({
        to: ctx.email,
        subject: 'Error al renovar tu membresía Premium — Gym Planner',
        template: 'renewal-failure',
        context: ctx,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send renewal failure email to ${ctx.email}`,
        err as Error,
      );
    }
  }
}
