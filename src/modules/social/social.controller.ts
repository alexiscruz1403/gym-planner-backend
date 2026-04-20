import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SocialService } from './social.service';
import { FollowQueryDto } from './dto/follow-query.dto';
import { FollowListResponseDto } from './dto/follow-user-response.dto';
import { FollowActionResponseDto } from './dto/follow-action-response.dto';
import { FollowRequestListResponseDto } from './dto/follow-request-response.dto';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Social')
@ApiBearerAuth('access-token')
@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('follow/:userId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Follow a user. Returns { pending: true } if the target has a private profile (request queued), or { pending: false } on immediate follow.',
  })
  @ApiParam({ name: 'userId', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 201, type: FollowActionResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot follow yourself' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description: 'Already following / request already pending',
  })
  async follow(
    @CurrentUser() user: JwtPayload,
    @Param('userId') targetId: string,
  ): Promise<FollowActionResponseDto> {
    const { pending } = await this.socialService.follow(user.sub, targetId);
    return {
      message: pending ? 'Follow request sent.' : 'Followed successfully.',
      pending,
    };
  }

  @Delete('follow/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiParam({ name: 'userId', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Unfollowed successfully' })
  @ApiResponse({ status: 404, description: 'Not following this user' })
  async unfollow(
    @CurrentUser() user: JwtPayload,
    @Param('userId') targetId: string,
  ): Promise<{ message: string }> {
    await this.socialService.unfollow(user.sub, targetId);
    return { message: 'Unfollowed successfully.' };
  }

  @Get('follow-requests/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List pending follow requests received by the current user',
  })
  @ApiResponse({ status: 200, type: FollowRequestListResponseDto })
  getPendingRequests(
    @CurrentUser() user: JwtPayload,
    @Query() query: FollowQueryDto,
  ): Promise<FollowRequestListResponseDto> {
    return this.socialService.getPendingRequests(user.sub, query);
  }

  @Post('follow-request/:userId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending follow request' })
  @ApiParam({ name: 'userId', description: 'Sender MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Follow request approved' })
  @ApiResponse({ status: 404, description: 'Follow request not found' })
  async approveFollowRequest(
    @CurrentUser() user: JwtPayload,
    @Param('userId') senderId: string,
  ): Promise<{ message: string }> {
    await this.socialService.approveFollowRequest(user.sub, senderId);
    return { message: 'Follow request approved.' };
  }

  @Delete('follow-request/:userId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending follow request' })
  @ApiParam({ name: 'userId', description: 'Sender MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Follow request rejected' })
  @ApiResponse({ status: 404, description: 'Follow request not found' })
  async rejectFollowRequest(
    @CurrentUser() user: JwtPayload,
    @Param('userId') senderId: string,
  ): Promise<{ message: string }> {
    await this.socialService.rejectFollowRequest(user.sub, senderId);
    return { message: 'Follow request rejected.' };
  }

  @Delete('follow-request/:userId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending follow request you sent' })
  @ApiParam({ name: 'userId', description: 'Recipient MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Follow request cancelled' })
  @ApiResponse({ status: 404, description: 'Follow request not found' })
  async cancelFollowRequest(
    @CurrentUser() user: JwtPayload,
    @Param('userId') recipientId: string,
  ): Promise<{ message: string }> {
    await this.socialService.cancelFollowRequest(user.sub, recipientId);
    return { message: 'Follow request cancelled.' };
  }

  @Get('followers/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get followers list for a user' })
  @ApiParam({ name: 'userId', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 200, type: FollowListResponseDto })
  async getFollowers(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() query: FollowQueryDto,
  ): Promise<FollowListResponseDto> {
    return this.socialService.getFollowers(userId, user.sub, query);
  }

  @Get('following/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get following list for a user' })
  @ApiParam({ name: 'userId', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 200, type: FollowListResponseDto })
  async getFollowing(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() query: FollowQueryDto,
  ): Promise<FollowListResponseDto> {
    return this.socialService.getFollowing(userId, user.sub, query);
  }
}
