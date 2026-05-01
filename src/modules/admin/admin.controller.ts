import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { GiftMembershipDto } from './dto/gift-membership.dto';
import { RevokeMembershipDto } from './dto/revoke-membership.dto';
import { MembershipAuditQueryDto } from './dto/membership-audit-query.dto';
import { MembershipAuditResponseDto } from './dto/membership-audit-response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { CreateSystemNotificationDto } from '../notifications/dto/create-system-notification.dto';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Roles('admin')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiResponse({ status: 200, type: [AdminUserResponseDto] })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  listUsers(@Query() query: AdminUsersQueryDto): Promise<{
    data: AdminUserResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or deactivate a user (admin only)' })
  @ApiParam({ name: 'id', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Cannot deactivate your own account',
  })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  setUserStatus(
    @Param('id') targetId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<AdminUserResponseDto> {
    return this.adminService.setUserStatus(targetId, dto, requester.sub);
  }

  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change a user role (admin only)' })
  @ApiParam({ name: 'id', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot change your own role' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  setUserRole(
    @Param('id') targetId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<AdminUserResponseDto> {
    return this.adminService.setUserRole(targetId, dto, requester.sub);
  }

  @Post('users/:id/membership/gift')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gift a premium membership to a user (admin only)' })
  @ApiParam({ name: 'id', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Membership gifted successfully' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  giftMembership(
    @Param('id') targetId: string,
    @Body() dto: GiftMembershipDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<void> {
    return this.adminService.giftMembership(targetId, requester.sub, dto);
  }

  @Post('users/:id/membership/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a premium membership from a user (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Membership revoked successfully' })
  @ApiResponse({ status: 400, description: 'User is already on the Free tier' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  revokeMembership(
    @Param('id') targetId: string,
    @Body() dto: RevokeMembershipDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<void> {
    return this.adminService.revokeMembership(targetId, requester.sub, dto);
  }

  @Get('membership/audits')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'List membership audit records with optional date-range filter (admin only)',
  })
  @ApiResponse({ status: 200, type: [MembershipAuditResponseDto] })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  listMembershipAudits(@Query() query: MembershipAuditQueryDto): Promise<{
    data: MembershipAuditResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.adminService.listMembershipAudits(query);
  }

  @Post('notifications')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Broadcast a system notification to every active user (admin only)',
  })
  @ApiResponse({ status: 201, description: 'Notifications dispatched' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  broadcastSystemNotification(
    @Body() dto: CreateSystemNotificationDto,
  ): Promise<{ delivered: number }> {
    return this.notifications.createSystemBroadcast(dto.title, dto.body);
  }
}
