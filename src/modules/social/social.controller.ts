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
  @ApiOperation({ summary: 'Follow a user' })
  @ApiParam({ name: 'userId', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'Followed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot follow yourself' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Already following this user' })
  async follow(
    @CurrentUser() user: JwtPayload,
    @Param('userId') targetId: string,
  ): Promise<{ message: string }> {
    await this.socialService.follow(user.sub, targetId);
    return { message: 'Followed successfully.' };
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
