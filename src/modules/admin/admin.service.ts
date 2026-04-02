import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private toAdminUserResponse(user: UserDocument): AdminUserResponseDto {
    return {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      createdAt: user.createdAt,
    };
  }

  // ─── Queries ──────────────────────────────────────────────────────────────────

  async listUsers(query: AdminUsersQueryDto): Promise<{
    data: AdminUserResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.username = { $regex: search, $options: 'i' };
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: users.map((u) => this.toAdminUserResponse(u)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Commands ─────────────────────────────────────────────────────────────────

  async setUserStatus(
    targetId: string,
    dto: UpdateUserStatusDto,
    requesterId: string,
  ): Promise<AdminUserResponseDto> {
    if (targetId === requesterId) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    const user = await this.userModel
      .findByIdAndUpdate(targetId, { isActive: dto.isActive }, { new: true })
      .exec();

    if (!user) throw new NotFoundException('User not found.');

    return this.toAdminUserResponse(user);
  }

  async setUserRole(
    targetId: string,
    dto: UpdateUserRoleDto,
    requesterId: string,
  ): Promise<AdminUserResponseDto> {
    if (targetId === requesterId) {
      throw new BadRequestException('You cannot change your own role.');
    }

    const user = await this.userModel
      .findByIdAndUpdate(targetId, { role: dto.role }, { new: true })
      .exec();

    if (!user) throw new NotFoundException('User not found.');

    return this.toAdminUserResponse(user);
  }
}
