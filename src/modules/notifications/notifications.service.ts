import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { Follow, FollowDocument } from '../../schemas/follow.schema';
import {
  Notification,
  NotificationDocument,
} from '../../schemas/notification.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationsGateway } from './notifications.gateway';

const COMMENT_PREVIEW_MAX = 200;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

interface ActorSnapshot {
  id: string;
  username: string;
  avatar?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    private readonly gateway: NotificationsGateway,
  ) {}

  // ─── Trigger handlers ─────────────────────────────────────────────────────

  async createForFollow(actorId: string, recipientId: string): Promise<void> {
    if (actorId === recipientId) return;

    const actor = await this.resolveActiveActor(actorId);
    if (!actor) return;

    const recipientActive = await this.isUserActive(recipientId);
    if (!recipientActive) return;

    await this.persistAndEmit({
      recipientId,
      actorId,
      type: NotificationType.FOLLOW,
      data: { actorUsername: actor.username, actorAvatar: actor.avatar },
    });
  }

  async createForLike(
    actorId: string,
    postOwnerId: string,
    postId: string,
  ): Promise<void> {
    if (actorId === postOwnerId) return;

    const actor = await this.resolveActiveActor(actorId);
    if (!actor) return;

    const recipientActive = await this.isUserActive(postOwnerId);
    if (!recipientActive) return;

    await this.persistAndEmit({
      recipientId: postOwnerId,
      actorId,
      type: NotificationType.POST_LIKE,
      data: {
        actorUsername: actor.username,
        actorAvatar: actor.avatar,
        postId,
      },
    });
  }

  async createForComment(
    actorId: string,
    postOwnerId: string,
    postId: string,
    commentText: string,
  ): Promise<void> {
    if (actorId === postOwnerId) return;

    const actor = await this.resolveActiveActor(actorId);
    if (!actor) return;

    const recipientActive = await this.isUserActive(postOwnerId);
    if (!recipientActive) return;

    await this.persistAndEmit({
      recipientId: postOwnerId,
      actorId,
      type: NotificationType.POST_COMMENT,
      data: {
        actorUsername: actor.username,
        actorAvatar: actor.avatar,
        postId,
        commentText: commentText.slice(0, COMMENT_PREVIEW_MAX),
      },
    });
  }

  async createForNewPost(actorId: string, postId: string): Promise<void> {
    const actor = await this.resolveActiveActor(actorId);
    if (!actor) return;

    const followers = await this.followModel
      .find({ followingId: new Types.ObjectId(actorId) })
      .select('followerId')
      .lean()
      .exec();

    if (!followers.length) return;

    const followerIds = followers.map((f) => f.followerId);
    const activeFollowers = await this.userModel
      .find({ _id: { $in: followerIds }, isActive: true })
      .select('_id')
      .lean()
      .exec();

    if (!activeFollowers.length) return;

    const docs = activeFollowers.map((f) => ({
      recipientId: f._id,
      actorId: new Types.ObjectId(actorId),
      type: NotificationType.NEW_POST,
      data: {
        actorUsername: actor.username,
        actorAvatar: actor.avatar,
        postId,
      },
      isRead: false,
    }));

    const inserted = await this.notificationModel.insertMany(docs);
    for (const n of inserted) {
      this.gateway.emitToUser(
        n.recipientId.toString(),
        this.toResponse(n as unknown as NotificationDocument),
      );
    }
  }

  async createSystemBroadcast(
    title: string,
    body: string,
  ): Promise<{ delivered: number }> {
    const activeUsers = await this.userModel
      .find({ isActive: true })
      .select('_id')
      .lean()
      .exec();

    if (!activeUsers.length) return { delivered: 0 };

    const docs = activeUsers.map((u) => ({
      recipientId: u._id,
      type: NotificationType.SYSTEM,
      data: { title, body },
      isRead: false,
    }));

    const inserted = await this.notificationModel.insertMany(docs);
    for (const n of inserted) {
      this.gateway.emitToUser(
        n.recipientId.toString(),
        this.toResponse(n as unknown as NotificationDocument),
      );
    }

    return { delivered: inserted.length };
  }

  // ─── Read API ─────────────────────────────────────────────────────────────

  async list(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<{
    data: NotificationResponseDto[];
    nextCursor: string | null;
  }> {
    const limit = query.limit ?? 20;

    const filter: Record<string, any> = {
      recipientId: new Types.ObjectId(userId),
    };
    if (query.unreadOnly) filter.isRead = false;
    if (query.cursor) filter.createdAt = { $lt: new Date(query.cursor) };

    const docs = await this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore
      ? slice[slice.length - 1].createdAt.toISOString()
      : null;

    return {
      data: slice.map((d) => this.toResponse(d)),
      nextCursor,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({
        recipientId: new Types.ObjectId(userId),
        isRead: false,
      })
      .exec();
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const result = await this.notificationModel
      .updateOne(
        {
          _id: new Types.ObjectId(notificationId),
          recipientId: new Types.ObjectId(userId),
        },
        { $set: { isRead: true } },
      )
      .exec();

    if (result.matchedCount === 0) {
      throw new NotFoundException('Notification not found.');
    }
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationModel
      .updateMany(
        { recipientId: new Types.ObjectId(userId), isRead: false },
        { $set: { isRead: true } },
      )
      .exec();
    return { updated: result.modifiedCount };
  }

  // ─── Cron purge ───────────────────────────────────────────────────────────

  async purgeOlderThanOneYear(): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - ONE_YEAR_MS);
    const result = await this.notificationModel
      .deleteMany({ createdAt: { $lt: cutoff } })
      .exec();
    this.logger.log(
      `Purged ${result.deletedCount} notifications older than ${cutoff.toISOString()}`,
    );
    return { deleted: result.deletedCount };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async persistAndEmit(input: {
    recipientId: string;
    actorId?: string;
    type: NotificationType;
    data: Record<string, any>;
  }): Promise<void> {
    const doc = await this.notificationModel.create({
      recipientId: new Types.ObjectId(input.recipientId),
      actorId: input.actorId ? new Types.ObjectId(input.actorId) : undefined,
      type: input.type,
      data: input.data,
      isRead: false,
    });

    this.gateway.emitToUser(input.recipientId, this.toResponse(doc));
  }

  private async resolveActiveActor(
    actorId: string,
  ): Promise<ActorSnapshot | null> {
    const user = await this.userModel
      .findById(actorId)
      .select('_id username avatar isActive')
      .lean()
      .exec();
    if (!user || !user.isActive) return null;
    return {
      id: user._id.toString(),
      username: user.username,
      avatar: user.avatar,
    };
  }

  private async isUserActive(userId: string): Promise<boolean> {
    const user = await this.userModel
      .findById(userId)
      .select('isActive')
      .lean()
      .exec();
    return !!user && user.isActive;
  }

  private toResponse(doc: NotificationDocument): NotificationResponseDto {
    return {
      _id: doc._id.toString(),
      type: doc.type,
      actorId: doc.actorId ? doc.actorId.toString() : null,
      data: doc.data,
      isRead: doc.isRead,
      createdAt: doc.createdAt,
    };
  }
}
