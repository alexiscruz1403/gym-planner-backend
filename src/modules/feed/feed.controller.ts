import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { FeedService } from './feed.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import {
  CommentListResponseDto,
  CommentResponseDto,
  FeedListResponseDto,
  FeedPostResponseDto,
} from './dto/feed-post-response.dto';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Feed')
@ApiBearerAuth('access-token')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a feed post from a completed session' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string' },
        caption: { type: 'string', maxLength: 500 },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, type: FeedPostResponseDto })
  @ApiResponse({ status: 403, description: 'Session does not belong to you' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 422, description: 'Session is still in progress' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createPost(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<FeedPostResponseDto> {
    return this.feedService.createPost(user.sub, dto, file);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the feed (posts from followed users, reverse chronological)',
  })
  @ApiResponse({ status: 200, type: FeedListResponseDto })
  async getFeed(
    @CurrentUser() user: JwtPayload,
    @Query() query: FeedQueryDto,
  ): Promise<FeedListResponseDto> {
    return this.feedService.getFeed(user.sub, query);
  }

  @Get('posts/:postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single feed post' })
  @ApiParam({ name: 'postId', description: 'FeedPost MongoDB ObjectId' })
  @ApiResponse({ status: 200, type: FeedPostResponseDto })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getPost(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
  ): Promise<FeedPostResponseDto> {
    return this.feedService.getPost(postId, user.sub);
  }

  @Post('posts/:postId/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a reaction to a post' })
  @ApiParam({ name: 'postId', description: 'FeedPost MongoDB ObjectId' })
  @ApiResponse({ status: 200, schema: { example: { reactionsCount: 4 } } })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 409, description: 'Already reacted' })
  async addReaction(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
  ): Promise<{ reactionsCount: number }> {
    return this.feedService.addReaction(user.sub, postId);
  }

  @Delete('posts/:postId/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove own reaction from a post' })
  @ApiParam({ name: 'postId', description: 'FeedPost MongoDB ObjectId' })
  @ApiResponse({ status: 200, schema: { example: { reactionsCount: 3 } } })
  @ApiResponse({ status: 404, description: 'Post or reaction not found' })
  async removeReaction(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
  ): Promise<{ reactionsCount: number }> {
    return this.feedService.removeReaction(user.sub, postId);
  }

  @Post('posts/:postId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiParam({ name: 'postId', description: 'FeedPost MongoDB ObjectId' })
  @ApiResponse({ status: 201, type: CommentResponseDto })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async addComment(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
    @Body() dto: AddCommentDto,
  ): Promise<CommentResponseDto> {
    return this.feedService.addComment(user.sub, postId, dto);
  }

  @Get('posts/:postId/comments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get paginated comments for a post' })
  @ApiParam({ name: 'postId', description: 'FeedPost MongoDB ObjectId' })
  @ApiResponse({ status: 200, type: CommentListResponseDto })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getComments(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
    @Query() query: FeedQueryDto,
  ): Promise<CommentListResponseDto> {
    return this.feedService.getComments(postId, query);
  }
}
