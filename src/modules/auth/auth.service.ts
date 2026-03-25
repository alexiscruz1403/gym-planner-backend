import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../../schemas/user.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../../schemas/refresh-token.schema';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

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

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<number>('JWT_EXPIRATION'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<number>('JWT_REFRESH_EXPIRATION'),
    });

    // Persist hashed refresh token
    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt = new Date(
      Date.now() +
        this.configService.get<number>('JWT_REFRESH_EXPIRATION')! * 1000,
    );

    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  // ─── Register ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if email already exists
    const existingByEmail = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .exec();

    if (existingByEmail) {
      // Edge case: email exists but belongs to an OAuth user (has googleId, no passwordHash)
      // We must not silently merge accounts — return a descriptive error
      if (existingByEmail.googleId && !existingByEmail.passwordHash) {
        throw new BadRequestException(
          'This email is already linked to a Google account. Sign in with Google, or set a password from your profile settings.',
        );
      }
      throw new ConflictException('Email already registered');
    }

    // Check if username already exists
    const existingByUsername = await this.userModel
      .findOne({ username: dto.username })
      .exec();
    if (existingByUsername) {
      throw new ConflictException('Username already taken');
    }

    // Hash password — never store plain text
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.userModel.create({
      email: dto.email.toLowerCase(),
      username: dto.username,
      passwordHash,
    });

    const tokens = await this.generateTokens(user._id.toString(), user.email);

    return { ...tokens, user: this.toResponseDto(user) };
  }

  // ─── Placeholders (implemented in upcoming tasks) ───────────────────────────

  async login(_dto: unknown): Promise<unknown> {
    throw new Error('Not implemented yet — see B-05');
  }

  async refresh(_refreshToken: string): Promise<unknown> {
    throw new Error('Not implemented yet — see B-06');
  }

  async logout(_refreshToken: string): Promise<void> {
    throw new Error('Not implemented yet — see B-07');
  }

  async findOrCreate(_googleProfile: unknown): Promise<unknown> {
    throw new Error('Not implemented yet — see B-13');
  }
}
