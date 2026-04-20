import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { User, UserDocument } from '../../schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import { UserSearchQueryDto } from './dto/user-search-query.dto';
import { AuthService } from '../auth/auth.service';
import { UploadService } from './upload.service';
import { SocialService } from '../social/social.service';

const PROFILE_CACHE_TTL = 300; // 5 minutes in seconds

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly authService: AuthService,
    private readonly uploadService: UploadService,
    private readonly socialService: SocialService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findPublicProfile(
    targetId: string,
    requesterId: string,
  ): Promise<PublicUserResponseDto> {
    const user = await this.userModel.findById(targetId).exec();
    if (!user) throw new NotFoundException('User not found.');

    const isFollowing = await this.socialService.isFollowing(
      requesterId,
      targetId,
    );

    // Private profile — only show username + avatar to non-approved viewers
    if (user.isPrivate && !isFollowing && requesterId !== targetId) {
      const isRequestPending = await this.socialService.isFollowRequestPending(
        requesterId,
        targetId,
      );

      return {
        _id: user._id.toString(),
        username: user.username,
        avatar: user.avatar,
        isPrivate: true,
        isFollowing: false,
        isRequestPending,
      };
    }

    return {
      _id: user._id.toString(),
      username: user.username,
      avatar: user.avatar,
      isPrivate: user.isPrivate,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      isFollowing,
      isRequestPending: false,
    };
  }

  async searchUsers(query: UserSearchQueryDto): Promise<{
    data: PublicUserResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { username, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (username) {
      filter.username = { $regex: username, $options: 'i' };
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    const data: PublicUserResponseDto[] = users.map((u) => ({
      _id: u._id.toString(),
      username: u.username,
      avatar: u.avatar,
      isPrivate: u.isPrivate,
      followersCount: u.isPrivate ? undefined : u.followersCount,
      followingCount: u.isPrivate ? undefined : u.followingCount,
      isFollowing: false, // bulk search does not compute follow state per entry
      isRequestPending: false,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const key = `user:profile:${id}`;
    const cached = await this.cacheManager.get<UserResponseDto>(key);
    if (cached) return cached;

    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');

    const result = this.authService.toResponseDto(user);
    await this.cacheManager.set(key, result, PROFILE_CACHE_TTL);
    return result;
  }

  async updateProfile(
    id: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    // If username is being updated, verify it's not already taken
    if (dto.username) {
      const existing = await this.userModel
        .findOne({ username: dto.username, _id: { $ne: id } })
        .exec();

      if (existing) {
        throw new ConflictException('Username already taken');
      }
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();

    if (!user) throw new NotFoundException('User not found');

    await this.cacheManager.del(`user:profile:${id}`);
    return this.authService.toResponseDto(user);
  }

  async uploadAvatar(
    id: string,
    file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    const avatarUrl = await this.uploadService.uploadAvatar(file);

    const user = await this.userModel
      .findByIdAndUpdate(id, { avatar: avatarUrl }, { new: true })
      .exec();

    if (!user) throw new NotFoundException('User not found');

    await this.cacheManager.del(`user:profile:${id}`);
    return this.authService.toResponseDto(user);
  }
}
