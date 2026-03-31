import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a public user profile' })
  @ApiParam({ name: 'id', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({ status: 200, type: PublicUserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid ObjectId format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicProfile(
    @CurrentUser() user: JwtPayload,
    @Param('id') targetId: string,
  ): Promise<PublicUserResponseDto> {
    return this.usersService.findPublicProfile(targetId, user.sub);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @UseInterceptors(
    FileInterceptor('file', {
      // Store file in memory as buffer — we pipe it directly to Cloudinary
      // without writing to disk first
      storage: undefined,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }
    return this.usersService.uploadAvatar(user.sub, file);
  }
}
