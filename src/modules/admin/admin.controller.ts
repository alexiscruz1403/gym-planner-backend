import {
  Controller,
  Get,
  Patch,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Roles('admin')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
}
