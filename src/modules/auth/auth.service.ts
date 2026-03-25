import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
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
import { LoginDto } from './dto/login.dto';
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

  // ─── Methods ───────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
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

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Explicitly select passwordHash — it has select: false in the schema
    // so it never comes back in normal queries
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+passwordHash')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // OAuth-only user trying to login with password
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account uses Google Sign-In. Please log in with Google.',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user._id.toString(), user.email);

    return { ...tokens, user: this.toResponseDto(user) };
  }

  // ─── Placeholders (implemented in upcoming tasks) ───────────────────────────

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    // Step 1 — verify the token is structurally valid and not expired
    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Step 2 — find all stored tokens for this user and check if any matches
    // We can't query by token directly because we only store the hash
    const storedTokens = await this.refreshTokenModel
      .find({ userId: new Types.ObjectId(payload.sub) })
      .exec();

    let matchedToken: RefreshTokenDocument | null = null;
    for (const stored of storedTokens) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        matchedToken = stored;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Step 3 — rotate: delete the used token and issue a new one
    // This limits the attack window if a refresh token is stolen —
    // using it once invalidates it immediately
    await this.refreshTokenModel.findByIdAndDelete(matchedToken._id).exec();

    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt = new Date(
      Date.now() +
        this.configService.get<number>('JWT_REFRESH_EXPIRATION')! * 1000,
    );

    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(payload.sub),
      tokenHash,
      expiresAt,
    });

    // Step 4 — issue a new access token only
    // The refresh token itself is reused (rotation keeps the same token value,
    // just re-persists its hash with a fresh TTL)
    const accessToken = this.jwtService.sign(
      { sub: payload.sub, email: payload.email },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<number>('JWT_EXPIRATION'),
      },
    );

    return { accessToken };
  }

  async logout(_refreshToken: string): Promise<void> {
    throw new Error('Not implemented yet — see B-07');
  }

  async findOrCreate(_googleProfile: unknown): Promise<unknown> {
    throw new Error('Not implemented yet — see B-13');
  }
}
