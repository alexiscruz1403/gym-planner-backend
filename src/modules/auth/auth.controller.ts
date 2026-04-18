import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { Public } from 'src/common/decorators';
import {
  COOKIE_NAMES,
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS,
} from './cookie.config';
import { AuthResponseDto } from './dto/auth-response.dto';
import { WsTokenResponseDto } from './dto/ws-token-response.dto';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
// Stricter rate limit for auth endpoints: 10 requests per 60 seconds per IP
@Throttle({ global: { ttl: 60000, limit: 10 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    res.cookie(COOKIE_NAMES.ACCESS, accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie(COOKIE_NAMES.REFRESH, refreshToken, REFRESH_COOKIE_OPTIONS);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user with email and password' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Email linked to a Google account' })
  @ApiResponse({
    status: 409,
    description: 'Email or username already registered',
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserResponseDto }> {
    const { accessToken, refreshToken, user } =
      await this.authService.register(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Account uses Google Sign-In' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserResponseDto }> {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue new access and refresh tokens using the refresh cookie',
  })
  @ApiResponse({ status: 200, description: 'Tokens refreshed via cookies' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH] as
      | string
      | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token cookie present');
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, accessToken, newRefreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invalidate the refresh token cookie and clear auth cookies',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH] as
      | string
      | undefined;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie(COOKIE_NAMES.ACCESS, CLEAR_COOKIE_OPTIONS);
    res.clearCookie(COOKIE_NAMES.REFRESH, CLEAR_COOKIE_OPTIONS);
    return { message: 'Logged out successfully' };
  }

  @Get('ws-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Issue a short-lived JWT (60s) for Socket.IO handshakes when access cookies are httpOnly',
  })
  @ApiResponse({ status: 200, type: WsTokenResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getWsToken(@CurrentUser() user: JwtPayload): WsTokenResponseDto {
    return this.authService.generateWsToken(user.sub, user.email, user.role);
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleAuth(): void {
    // Passport redirects to Google automatically — this method body never executes
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // At this point Passport has already called GoogleStrategy.validate()
    // and attached the result to req.user
    const { accessToken, refreshToken } = req.user as AuthResponseDto;

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    res.cookie(COOKIE_NAMES.ACCESS, accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie(COOKIE_NAMES.REFRESH, refreshToken, REFRESH_COOKIE_OPTIONS);
    // Redirect without tokens in query params — frontend calls getMe() to hydrate
    res.redirect(`${frontendUrl}/auth/callback`);
  }
}
