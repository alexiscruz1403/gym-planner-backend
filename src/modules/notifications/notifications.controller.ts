import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "List the current user's notifications (newest first)",
  })
  @ApiResponse({ status: 200 })
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<{
    data: NotificationResponseDto[];
    nextCursor: string | null;
  }> {
    return this.notifications.list(user.sub, query);
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Return the unread notification count for the current user',
  })
  @ApiResponse({ status: 200 })
  async unreadCount(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ count: number }> {
    const count = await this.notifications.getUnreadCount(user.sub);
    return { count };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Mark all of the current user's notifications as read",
  })
  @ApiResponse({ status: 200 })
  markAllAsRead(@CurrentUser() user: JwtPayload): Promise<{ updated: number }> {
    return this.notifications.markAllAsRead(user.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification MongoDB ObjectId' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.notifications.markAsRead(user.sub, id);
  }
}
