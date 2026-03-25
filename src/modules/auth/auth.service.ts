//import { Injectable, ConflictException, UnauthorizedException, } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { UserResponseDto } from '../users/dto/user-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // Maps a UserDocument to a safe response DTO — never exposes passwordHash
  toResponseDto(user: UserDocument): UserResponseDto {
    return {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      createdAt: user.createdAt,
    };
  }

  // Implemented in B-04
  async register(_dto: unknown): Promise<unknown> {
    throw new Error('Not implemented yet — see B-04');
  }

  // Implemented in B-05
  async login(_dto: unknown): Promise<unknown> {
    throw new Error('Not implemented yet — see B-05');
  }

  // Implemented in B-06
  async refresh(_refreshToken: string): Promise<unknown> {
    throw new Error('Not implemented yet — see B-06');
  }

  // Implemented in B-07
  async logout(_refreshToken: string): Promise<void> {
    throw new Error('Not implemented yet — see B-07');
  }

  // Implemented in B-13
  async findOrCreate(_googleProfile: unknown): Promise<unknown> {
    throw new Error('Not implemented yet — see B-13');
  }
}
