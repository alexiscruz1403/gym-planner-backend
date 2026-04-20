import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  NOTIFICATION_EVENTS,
  FollowRequestAcceptedEvent,
  FollowRequestSentEvent,
  PostCommentedEvent,
  PostCreatedEvent,
  PostLikedEvent,
  UserFollowedEvent,
} from './events/notification.events';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(NOTIFICATION_EVENTS.USER_FOLLOWED, { async: true })
  async handleFollow(event: UserFollowedEvent): Promise<void> {
    try {
      await this.notifications.createForFollow(
        event.actorId,
        event.recipientId,
      );
    } catch (err) {
      this.logger.error('Failed to handle USER_FOLLOWED', err as Error);
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.POST_LIKED, { async: true })
  async handleLike(event: PostLikedEvent): Promise<void> {
    try {
      await this.notifications.createForLike(
        event.actorId,
        event.postOwnerId,
        event.postId,
      );
    } catch (err) {
      this.logger.error('Failed to handle POST_LIKED', err as Error);
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.POST_COMMENTED, { async: true })
  async handleComment(event: PostCommentedEvent): Promise<void> {
    try {
      await this.notifications.createForComment(
        event.actorId,
        event.postOwnerId,
        event.postId,
        event.commentText,
      );
    } catch (err) {
      this.logger.error('Failed to handle POST_COMMENTED', err as Error);
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.POST_CREATED, { async: true })
  async handlePostCreated(event: PostCreatedEvent): Promise<void> {
    try {
      await this.notifications.createForNewPost(event.actorId, event.postId);
    } catch (err) {
      this.logger.error('Failed to handle POST_CREATED', err as Error);
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.FOLLOW_REQUEST_SENT, { async: true })
  async handleFollowRequest(event: FollowRequestSentEvent): Promise<void> {
    try {
      await this.notifications.createForFollowRequest(
        event.senderId,
        event.recipientId,
      );
    } catch (err) {
      this.logger.error('Failed to handle FOLLOW_REQUEST_SENT', err as Error);
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.FOLLOW_REQUEST_ACCEPTED, { async: true })
  async handleFollowAccepted(event: FollowRequestAcceptedEvent): Promise<void> {
    try {
      await this.notifications.createForFollowAccepted(
        event.senderId,
        event.recipientId,
      );
    } catch (err) {
      this.logger.error(
        'Failed to handle FOLLOW_REQUEST_ACCEPTED',
        err as Error,
      );
    }
  }
}
