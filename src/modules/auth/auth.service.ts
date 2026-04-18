import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
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
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email, role };

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

    // Eagerly remove already-expired tokens for this user before inserting a new one.
    // Belt-and-suspenders alongside the MongoDB TTL index — prevents accumulation
    // when a user logs in repeatedly without logging out. Valid tokens from other
    // active sessions (multi-device) are preserved.
    await this.refreshTokenModel
      .deleteMany({
        userId: new Types.ObjectId(userId),
        expiresAt: { $lte: new Date() },
      })
      .exec();

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

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );

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

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated.');
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

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );

    return { ...tokens, user: this.toResponseDto(user) };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Step 1 — verify the token is structurally valid and not expired
    let payload: { sub: string; email: string; role: string };
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

    // Step 3 — rotate: delete the used token, then generate brand-new tokens.
    // A new refresh token JWT is issued (not the same value re-stored) so that
    // re-presenting the old token after rotation always fails bcrypt compare.
    await this.refreshTokenModel.findByIdAndDelete(matchedToken._id).exec();

    const tokenPayload = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    const accessToken = this.jwtService.sign(tokenPayload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<number>('JWT_EXPIRATION'),
    });

    const newRefreshToken = this.jwtService.sign(tokenPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<number>('JWT_REFRESH_EXPIRATION'),
    });

    const tokenHash = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);
    const expiresAt = new Date(
      Date.now() +
        this.configService.get<number>('JWT_REFRESH_EXPIRATION')! * 1000,
    );

    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(payload.sub),
      tokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    // Step 1 — verify the token is structurally valid
    // We do this before touching the DB to avoid unnecessary queries
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      // If the token is invalid or expired we still return 200 —
      // from the client's perspective the session is gone either way
      return;
    }

    // Step 2 — find and delete the matching stored token
    const storedTokens = await this.refreshTokenModel
      .find({ userId: new Types.ObjectId(payload.sub) })
      .exec();

    for (const stored of storedTokens) {
      const isMatch = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (isMatch) {
        await this.refreshTokenModel.findByIdAndDelete(stored._id).exec();
        break;
      }
    }
  }

  // Issues a short-lived JWT intended for the Socket.IO handshake.
  // Signed with the same JWT_SECRET + payload shape as the access token,
  // so the notifications gateway validates it with its existing verifyAsync call.
  generateWsToken(
    userId: string,
    email: string,
    role: string,
  ): { token: string; expiresAt: Date } {
    const ttlSeconds = 60;
    const token = this.jwtService.sign(
      { sub: userId, email, role },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: ttlSeconds,
      },
    );
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return { token, expiresAt };
  }

  async findOrCreate(googleProfile: {
    googleId: string;
    email: string;
    username: string;
  }): Promise<AuthResponseDto> {
    // Step 1 — look up by googleId first (fastest path for returning users)
    let user = await this.userModel
      .findOne({ googleId: googleProfile.googleId })
      .exec();

    if (user) {
      const tokens = await this.generateTokens(
        user._id.toString(),
        user.email,
        user.role,
      );
      return { ...tokens, user: this.toResponseDto(user) };
    }

    // Step 2 — look up by email (user may have registered with email/password first)
    const existingByEmail = await this.userModel
      .findOne({ email: googleProfile.email.toLowerCase() })
      .exec();

    if (existingByEmail) {
      // Email exists but belongs to an email/password account — do not merge silently
      if (existingByEmail.passwordHash && !existingByEmail.googleId) {
        throw new BadRequestException(
          'This email is already registered with a password. Please log in with email and password.',
        );
      }

      // Edge case: email exists with googleId already — return tokens normally
      const tokens = await this.generateTokens(
        existingByEmail._id.toString(),
        existingByEmail.email,
        existingByEmail.role,
      );
      return { ...tokens, user: this.toResponseDto(existingByEmail) };
    }

    // Step 3 — new user, create account without passwordHash
    // Generate a unique username — Google displayName may already be taken
    const baseUsername = googleProfile.username
      .toLowerCase()
      .replace(/\s+/g, '')
      .slice(0, 15);

    let username = baseUsername;
    let attempts = 0;

    while (await this.userModel.findOne({ username }).exec()) {
      attempts++;
      username = `${baseUsername}${attempts}`;
    }

    user = await this.userModel.create({
      email: googleProfile.email.toLowerCase(),
      username,
      googleId: googleProfile.googleId,
    });

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );
    return { ...tokens, user: this.toResponseDto(user) };
  }
}
