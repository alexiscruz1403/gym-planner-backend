import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsCronService {
  private readonly logger = new Logger(NotificationsCronService.name);

  constructor(private readonly notifications: NotificationsService) {}

  // Daily at 00:00 UTC — purge notifications older than one year.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'UTC' })
  async purgeOldNotifications(): Promise<void> {
    try {
      await this.notifications.purgeOlderThanOneYear();
    } catch (err) {
      this.logger.error('Cron purge failed', err as Error);
    }
  }
}
