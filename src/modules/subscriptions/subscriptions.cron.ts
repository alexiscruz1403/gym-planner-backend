import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class SubscriptionsCronService {
  private readonly logger = new Logger(SubscriptionsCronService.name);

  constructor(private readonly subscriptions: SubscriptionsService) {}

  // Daily at 02:00 UTC — safety net for memberships that expired but weren't
  // downgraded via webhook (network failures, missed events, etc.)
  @Cron('0 2 * * *', { timeZone: 'UTC' })
  async handleExpiry(): Promise<void> {
    try {
      await this.subscriptions.expireOverdueMemberships();
    } catch (err) {
      this.logger.error('Membership expiry cron failed', err as Error);
    }
  }
}
