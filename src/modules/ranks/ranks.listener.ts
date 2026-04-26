import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RanksService } from './ranks.service';
import {
  RANK_EVENTS,
  SessionCompletedForRanksEvent,
} from './events/rank.events';

@Injectable()
export class RanksListener {
  private readonly logger = new Logger(RanksListener.name);

  constructor(private readonly ranksService: RanksService) {}

  @OnEvent(RANK_EVENTS.SESSION_COMPLETED, { async: true })
  async handleSessionCompleted(
    event: SessionCompletedForRanksEvent,
  ): Promise<void> {
    try {
      await this.ranksService.processSessionCompletion(
        event.userId,
        event.exercises,
      );
    } catch (err) {
      this.logger.error(
        `Rank calculation failed for user ${event.userId}`,
        err,
      );
    }
  }
}
