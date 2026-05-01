import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import {
  AdminMembershipAudit,
  AdminMembershipAuditDocument,
} from '../../schemas/admin-membership-audit.schema';
import { MembershipTier } from '../../common/enums/membership-tier.enum';
import { MembershipStatus } from '../../common/enums/membership-status.enum';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { GiftMembershipDto } from './dto/gift-membership.dto';
import { RevokeMembershipDto } from './dto/revoke-membership.dto';
import { MembershipAuditQueryDto } from './dto/membership-audit-query.dto';
import { MembershipAuditResponseDto } from './dto/membership-audit-response.dto';
import { NotificationsService } from '../notifications/notifications.service';

const DAYS_PER_PLAN: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.MONTHLY]: 30,
  [SubscriptionPlan.ANNUAL]: 365,
};

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AdminMembershipAudit.name)
    private readonly auditModel: Model<AdminMembershipAuditDocument>,
    private readonly notificationsService: NotificationsService,
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
      membershipTier: user.membershipTier,
      membershipStatus: user.membershipStatus,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      createdAt: user.createdAt,
    };
  }

  private toAuditResponse(
    doc: AdminMembershipAuditDocument,
  ): MembershipAuditResponseDto {
    return {
      _id: doc._id.toString(),
      adminId: doc.adminId.toString(),
      targetUserId: doc.targetUserId.toString(),
      action: doc.action,
      plan: doc.plan,
      reason: doc.reason,
      createdAt: doc.createdAt,
    };
  }

  // ─── Users ────────────────────────────────────────────────────────────────────

  async listUsers(query: AdminUsersQueryDto): Promise<{
    data: AdminUserResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { username, role, membershipTier, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (username) {
      filter.username = { $regex: username, $options: 'i' };
    }
    if (role) {
      filter.role = role;
    }
    if (membershipTier) {
      filter.membershipTier = membershipTier;
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

  // ─── Membership management ────────────────────────────────────────────────────

  async giftMembership(
    targetId: string,
    adminId: string,
    dto: GiftMembershipDto,
  ): Promise<void> {
    const user = await this.userModel.findById(targetId).exec();
    if (!user) throw new NotFoundException('User not found.');

    const daysToAdd = DAYS_PER_PLAN[dto.plan];
    const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

    await this.userModel
      .findByIdAndUpdate(targetId, {
        membershipTier: MembershipTier.PREMIUM,
        membershipStatus: MembershipStatus.ACTIVE,
        membershipExpiresAt: expiresAt,
        autoRenew: false,
      })
      .exec();

    await this.auditModel.create({
      adminId: new Types.ObjectId(adminId),
      targetUserId: new Types.ObjectId(targetId),
      action: 'gift',
      plan: dto.plan,
    });

    await this.notificationsService.createSystemNotificationForUser(
      targetId,
      '¡Recibiste una membresía Premium de regalo!',
      `Tu cuenta fue actualizada a Premium (plan ${dto.plan}) como obsequio del equipo. No se realizó ningún cargo a tu cuenta.`,
    );
  }

  async revokeMembership(
    targetId: string,
    adminId: string,
    dto: RevokeMembershipDto,
  ): Promise<void> {
    const user = await this.userModel.findById(targetId).exec();
    if (!user) throw new NotFoundException('User not found.');

    if (user.membershipTier === MembershipTier.FREE) {
      throw new BadRequestException('User is already on the Free tier.');
    }

    await this.userModel
      .findByIdAndUpdate(targetId, {
        membershipTier: MembershipTier.FREE,
        membershipStatus: MembershipStatus.CANCELLED,
        $unset: { membershipExpiresAt: '' },
        autoRenew: false,
      })
      .exec();

    await this.auditModel.create({
      adminId: new Types.ObjectId(adminId),
      targetUserId: new Types.ObjectId(targetId),
      action: 'revoke',
      reason: dto.reason,
    });

    await this.notificationsService.createSystemNotificationForUser(
      targetId,
      'Tu membresía Premium fue revocada',
      `Tu membresía Premium fue degradada a Free. Motivo: ${dto.reason}`,
    );
  }

  // ─── Audit ────────────────────────────────────────────────────────────────────

  async listMembershipAudits(query: MembershipAuditQueryDto): Promise<{
    data: MembershipAuditResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { from, to, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter['$gte'] = new Date(from);
      if (to) dateFilter['$lte'] = new Date(to);
      filter.createdAt = dateFilter;
    }

    const [docs, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return {
      data: docs.map((d) => this.toAuditResponse(d)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
