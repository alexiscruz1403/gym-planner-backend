import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import { AuthService } from '../auth/auth.service';
import { UploadService } from './upload.service';
import { SocialService } from '../social/social.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly authService: AuthService,
    private readonly uploadService: UploadService,
    private readonly socialService: SocialService,
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

    return {
      _id: user._id.toString(),
      username: user.username,
      avatar: user.avatar,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      isFollowing,
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return this.authService.toResponseDto(user);
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

    return this.authService.toResponseDto(user);
  }
}
