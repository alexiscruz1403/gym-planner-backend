import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NOTIFICATION_EVENTS,
  UserFollowedEvent,
  FollowRequestSentEvent,
  FollowRequestAcceptedEvent,
} from '../notifications/events/notification.events';
import { Follow, FollowDocument } from '../../schemas/follow.schema';
import {
  FollowRequest,
  FollowRequestDocument,
} from '../../schemas/follow-request.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { FollowQueryDto } from './dto/follow-query.dto';
import {
  FollowListResponseDto,
  FollowUserResponseDto,
} from './dto/follow-user-response.dto';
import {
  FollowRequestListResponseDto,
  FollowRequestResponseDto,
} from './dto/follow-request-response.dto';

@Injectable()
export class SocialService {
  constructor(
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    @InjectModel(FollowRequest.name)
    private readonly followRequestModel: Model<FollowRequestDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async follow(
    followerId: string,
    followingId: string,
  ): Promise<{ pending: boolean }> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself.');
    }

    const target = await this.userModel.findById(followingId).exec();
    if (!target) throw new NotFoundException('User not found.');

    const existing = await this.followModel
      .findOne({
        followerId: new Types.ObjectId(followerId),
        followingId: new Types.ObjectId(followingId),
      })
      .exec();

    if (existing)
      throw new ConflictException('You are already following this user.');

    // Private profile — queue a follow request instead of an immediate follow
    if (target.isPrivate) {
      const pendingRequest = await this.followRequestModel
        .findOne({
          senderId: new Types.ObjectId(followerId),
          recipientId: new Types.ObjectId(followingId),
        })
        .exec();

      if (pendingRequest) {
        throw new ConflictException('Follow request already pending.');
      }

      await this.followRequestModel.create({
        senderId: new Types.ObjectId(followerId),
        recipientId: new Types.ObjectId(followingId),
      });

      this.eventEmitter.emit(
        NOTIFICATION_EVENTS.FOLLOW_REQUEST_SENT,
        new FollowRequestSentEvent(followerId, followingId),
      );

      return { pending: true };
    }

    // Public profile — immediate follow
    await this.followModel.create({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(followingId),
    });

    await Promise.all([
      this.userModel
        .findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } })
        .exec(),
      this.userModel
        .findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } })
        .exec(),
    ]);

    this.eventEmitter.emit(
      NOTIFICATION_EVENTS.USER_FOLLOWED,
      new UserFollowedEvent(followerId, followingId),
    );

    return { pending: false };
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const result = await this.followModel
      .findOneAndDelete({
        followerId: new Types.ObjectId(followerId),
        followingId: new Types.ObjectId(followingId),
      })
      .exec();

    if (!result)
      throw new NotFoundException('You are not following this user.');

    await Promise.all([
      this.userModel
        .findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } })
        .exec(),
      this.userModel
        .findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } })
        .exec(),
    ]);
  }

  async approveFollowRequest(
    approverId: string,
    senderId: string,
  ): Promise<void> {
    const request = await this.followRequestModel
      .findOne({
        senderId: new Types.ObjectId(senderId),
        recipientId: new Types.ObjectId(approverId),
      })
      .exec();

    if (!request) throw new NotFoundException('Follow request not found.');

    // Check if the sender is still an active user before creating the follow
    const senderUser = await this.userModel
      .findById(senderId)
      .select('isActive')
      .lean()
      .exec();

    await this.followRequestModel.findByIdAndDelete(request._id).exec();

    if (!senderUser || !senderUser.isActive) return;

    // Prevent duplicate Follow doc in case of a race condition
    const existing = await this.followModel
      .findOne({
        followerId: new Types.ObjectId(senderId),
        followingId: new Types.ObjectId(approverId),
      })
      .exec();

    if (!existing) {
      await this.followModel.create({
        followerId: new Types.ObjectId(senderId),
        followingId: new Types.ObjectId(approverId),
      });

      await Promise.all([
        this.userModel
          .findByIdAndUpdate(approverId, { $inc: { followersCount: 1 } })
          .exec(),
        this.userModel
          .findByIdAndUpdate(senderId, { $inc: { followingCount: 1 } })
          .exec(),
      ]);
    }

    // Notify the approver of the new follower
    this.eventEmitter.emit(
      NOTIFICATION_EVENTS.USER_FOLLOWED,
      new UserFollowedEvent(senderId, approverId),
    );

    // Notify the requester that their request was accepted
    this.eventEmitter.emit(
      NOTIFICATION_EVENTS.FOLLOW_REQUEST_ACCEPTED,
      new FollowRequestAcceptedEvent(approverId, senderId),
    );
  }

  async rejectFollowRequest(
    approverId: string,
    senderId: string,
  ): Promise<void> {
    const result = await this.followRequestModel
      .findOneAndDelete({
        senderId: new Types.ObjectId(senderId),
        recipientId: new Types.ObjectId(approverId),
      })
      .exec();

    if (!result) throw new NotFoundException('Follow request not found.');
  }

  async cancelFollowRequest(
    senderId: string,
    recipientId: string,
  ): Promise<void> {
    const result = await this.followRequestModel
      .findOneAndDelete({
        senderId: new Types.ObjectId(senderId),
        recipientId: new Types.ObjectId(recipientId),
      })
      .exec();

    if (!result) throw new NotFoundException('Follow request not found.');
  }

  async getPendingRequests(
    userId: string,
    query: FollowQueryDto,
  ): Promise<FollowRequestListResponseDto> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const recipientId = new Types.ObjectId(userId);

    const [requests, total] = await Promise.all([
      this.followRequestModel
        .find({ recipientId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate<{ senderId: UserDocument }>('senderId', '_id username avatar')
        .exec(),
      this.followRequestModel.countDocuments({ recipientId }).exec(),
    ]);

    const data: FollowRequestResponseDto[] = requests.map((r) => {
      const sender = r.senderId as unknown as UserDocument;
      return {
        _id: r._id.toString(),
        senderId: sender._id.toString(),
        username: sender.username,
        avatar: sender.avatar,
        createdAt: r.createdAt,
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async isFollowRequestPending(
    senderId: string,
    recipientId: string,
  ): Promise<boolean> {
    const doc = await this.followRequestModel
      .findOne({
        senderId: new Types.ObjectId(senderId),
        recipientId: new Types.ObjectId(recipientId),
      })
      .select('_id')
      .lean()
      .exec();
    return !!doc;
  }

  async getFollowers(
    userId: string,
    requesterId: string,
    query: FollowQueryDto,
  ): Promise<FollowListResponseDto> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const followingId = new Types.ObjectId(userId);

    const [followDocs, total] = await Promise.all([
      this.followModel
        .find({ followingId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate<{
          followerId: UserDocument;
        }>('followerId', '_id username avatar')
        .exec(),
      this.followModel.countDocuments({ followingId }).exec(),
    ]);

    const followerIds = followDocs.map((f) =>
      (f.followerId as unknown as UserDocument)._id.toString(),
    );

    const requesterFollowing = await this.getFollowingIdSet(
      requesterId,
      followerIds,
    );

    const data: FollowUserResponseDto[] = followDocs.map((f) => {
      const user = f.followerId as unknown as UserDocument;
      return {
        _id: user._id.toString(),
        username: user.username,
        avatar: user.avatar,
        isFollowing: requesterFollowing.has(user._id.toString()),
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFollowing(
    userId: string,
    requesterId: string,
    query: FollowQueryDto,
  ): Promise<FollowListResponseDto> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const followerId = new Types.ObjectId(userId);

    const [followDocs, total] = await Promise.all([
      this.followModel
        .find({ followerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate<{
          followingId: UserDocument;
        }>('followingId', '_id username avatar')
        .exec(),
      this.followModel.countDocuments({ followerId }).exec(),
    ]);

    const followingIds = followDocs.map((f) =>
      (f.followingId as unknown as UserDocument)._id.toString(),
    );

    const requesterFollowing = await this.getFollowingIdSet(
      requesterId,
      followingIds,
    );

    const data: FollowUserResponseDto[] = followDocs.map((f) => {
      const user = f.followingId as unknown as UserDocument;
      return {
        _id: user._id.toString(),
        username: user.username,
        avatar: user.avatar,
        isFollowing: requesterFollowing.has(user._id.toString()),
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const doc = await this.followModel
      .findOne({
        followerId: new Types.ObjectId(followerId),
        followingId: new Types.ObjectId(followingId),
      })
      .select('_id')
      .lean()
      .exec();

    return !!doc;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  // Returns a Set of userIds from `candidates` that the requester is following.
  private async getFollowingIdSet(
    requesterId: string,
    candidates: string[],
  ): Promise<Set<string>> {
    if (!candidates.length) return new Set();

    const docs = await this.followModel
      .find({
        followerId: new Types.ObjectId(requesterId),
        followingId: { $in: candidates.map((id) => new Types.ObjectId(id)) },
      })
      .select('followingId')
      .lean()
      .exec();

    return new Set(docs.map((d) => d.followingId.toString()));
  }
}
