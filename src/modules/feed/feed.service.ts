import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FeedPost, FeedPostDocument } from '../../schemas/feed-post.schema';
import { Follow, FollowDocument } from '../../schemas/follow.schema';
import {
  WorkoutSession,
  WorkoutSessionDocument,
} from '../../schemas/workout-session.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { UploadService } from '../users/upload.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import {
  CommentListResponseDto,
  CommentResponseDto,
  FeedListResponseDto,
  FeedPostResponseDto,
} from './dto/feed-post-response.dto';
import { SessionStatus } from '../../common/enums/session-status.enum';

@Injectable()
export class FeedService {
  constructor(
    @InjectModel(FeedPost.name)
    private readonly feedPostModel: Model<FeedPostDocument>,
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    @InjectModel(WorkoutSession.name)
    private readonly sessionModel: Model<WorkoutSessionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly uploadService: UploadService,
  ) {}

  // ─── Create post ─────────────────────────────────────────────────────────────

  async createPost(
    userId: string,
    dto: CreatePostDto,
    file?: Express.Multer.File,
  ): Promise<FeedPostResponseDto> {
    const session = await this.sessionModel
      .findById(dto.sessionId)
      .select('userId status')
      .exec();

    if (!session) throw new NotFoundException('Session not found.');
    if (session.userId.toString() !== userId) {
      throw new ForbiddenException('Session does not belong to you.');
    }
    if (session.status === SessionStatus.IN_PROGRESS) {
      throw new UnprocessableEntityException(
        'Cannot create a post from an in-progress session.',
      );
    }

    let photoUrl: string | undefined;
    if (file) {
      photoUrl = await this.uploadService.uploadImage(file, 'gym-planner/feed');
    }

    const post = await this.feedPostModel.create({
      userId: new Types.ObjectId(userId),
      sessionId: new Types.ObjectId(dto.sessionId),
      photoUrl,
      caption: dto.caption,
    });

    const author = await this.userModel
      .findById(userId)
      .select('_id username avatar')
      .lean()
      .exec();

    return this.toFeedPostResponse(post, author!, userId);
  }

  // ─── Get feed ────────────────────────────────────────────────────────────────

  async getFeed(
    userId: string,
    query: FeedQueryDto,
  ): Promise<FeedListResponseDto> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const followDocs = await this.followModel
      .find({ followerId: new Types.ObjectId(userId) })
      .select('followingId')
      .lean()
      .exec();

    const followingIds = followDocs.map((f) => f.followingId);

    // Include the requester's own posts alongside followed users' posts
    const feedUserIds = [new Types.ObjectId(userId), ...followingIds];

    const filter = { userId: { $in: feedUserIds } };

    const [posts, total] = await Promise.all([
      this.feedPostModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate<{ userId: UserDocument }>('userId', '_id username avatar')
        .exec(),
      this.feedPostModel.countDocuments(filter).exec(),
    ]);

    const data = posts.map((post) => {
      const author = post.userId as unknown as UserDocument;
      return this.toFeedPostResponse(
        post as unknown as FeedPostDocument,
        author,
        userId,
      );
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Get single post ─────────────────────────────────────────────────────────

  async getPost(
    postId: string,
    requesterId: string,
  ): Promise<FeedPostResponseDto> {
    const post = await this.feedPostModel
      .findById(postId)
      .populate<{ userId: UserDocument }>('userId', '_id username avatar')
      .exec();

    if (!post) throw new NotFoundException('Post not found.');

    return this.toFeedPostResponse(
      post,
      post.userId as unknown as UserDocument,
      requesterId,
    );
  }

  // ─── Reactions ───────────────────────────────────────────────────────────────

  async addReaction(
    userId: string,
    postId: string,
  ): Promise<{ reactionsCount: number }> {
    const post = await this.feedPostModel.findById(postId).exec();
    if (!post) throw new NotFoundException('Post not found.');

    const alreadyReacted = post.reactions.some(
      (r) => r.userId.toString() === userId,
    );
    if (alreadyReacted)
      throw new ConflictException('You have already reacted to this post.');

    post.reactions.push({ userId: new Types.ObjectId(userId), type: 'like' });
    await post.save();

    return { reactionsCount: post.reactions.length };
  }

  async removeReaction(
    userId: string,
    postId: string,
  ): Promise<{ reactionsCount: number }> {
    const post = await this.feedPostModel.findById(postId).exec();
    if (!post) throw new NotFoundException('Post not found.');

    const index = post.reactions.findIndex(
      (r) => r.userId.toString() === userId,
    );
    if (index === -1) throw new NotFoundException('Reaction not found.');

    post.reactions.splice(index, 1);
    await post.save();

    return { reactionsCount: post.reactions.length };
  }

  // ─── Comments ────────────────────────────────────────────────────────────────

  async addComment(
    userId: string,
    postId: string,
    dto: AddCommentDto,
  ): Promise<CommentResponseDto> {
    const post = await this.feedPostModel.findById(postId).exec();
    if (!post) throw new NotFoundException('Post not found.');

    const author = await this.userModel
      .findById(userId)
      .select('username')
      .lean()
      .exec();

    if (!author) throw new NotFoundException('User not found.');

    const comment = {
      userId: new Types.ObjectId(userId),
      text: dto.text,
      createdAt: new Date(),
    };

    post.comments.push(comment);
    await post.save();

    return {
      userId,
      username: author.username,
      text: dto.text,
      createdAt: comment.createdAt,
    };
  }

  async getComments(
    postId: string,
    query: FeedQueryDto,
  ): Promise<CommentListResponseDto> {
    const post = await this.feedPostModel
      .findById(postId)
      .select('comments')
      .exec();

    if (!post) throw new NotFoundException('Post not found.');

    const { page = 1, limit = 20 } = query;
    const total = post.comments.length;
    const skip = (page - 1) * limit;
    const slice = post.comments.slice(skip, skip + limit);

    const userIds = [...new Set(slice.map((c) => c.userId.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('_id username')
      .lean()
      .exec();

    const usernameMap = new Map(
      users.map((u) => [u._id.toString(), u.username]),
    );

    const data: CommentResponseDto[] = slice.map((c) => ({
      userId: c.userId.toString(),
      username: usernameMap.get(c.userId.toString()) ?? 'unknown',
      text: c.text,
      createdAt: c.createdAt,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private toFeedPostResponse(
    post: Pick<
      FeedPostDocument,
      | '_id'
      | 'sessionId'
      | 'photoUrl'
      | 'caption'
      | 'reactions'
      | 'comments'
      | 'createdAt'
    >,
    author: Pick<UserDocument, '_id' | 'username' | 'avatar'>,
    requesterId: string,
  ): FeedPostResponseDto {
    const userReacted = post.reactions.some(
      (r) => r.userId.toString() === requesterId,
    );

    return {
      _id: post._id.toString(),
      author: {
        _id: author._id.toString(),
        username: author.username,
        avatar: author.avatar,
      },
      sessionId: post.sessionId.toString(),
      photoUrl: post.photoUrl,
      caption: post.caption,
      reactionsCount: post.reactions.length,
      commentsCount: post.comments.length,
      userReacted,
      createdAt: post.createdAt,
    };
  }
}
