import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { FeatureFlagService } from '../features/feature-flag.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, RefreshTokenDto } from './dto/auth.dto';
import { Public, CurrentUser } from '../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { getAppBaseUrl, getFrontendUrl } from '../common/app-url';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    await this.flags.assertEnabled('user_registration');
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    return this.auth.revokeRefreshToken(dto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  async forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  async reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return this.auth.getMe(user.id);
  }

  @Public()
  @Get('callback-urls')
  callbackUrls() {
    return {
      appBaseUrl: getAppBaseUrl(this.config),
      frontendUrl: getFrontendUrl(this.config),
      google: {
        configured: Boolean(this.config.get('GOOGLE_CLIENT_ID')),
        callbackUrl: `${getAppBaseUrl(this.config)}/api/auth/google/callback`,
      },
      facebook: {
        configured: Boolean(this.config.get('FACEBOOK_APP_ID')),
        callbackUrl: `${getAppBaseUrl(this.config)}/api/auth/facebook/callback`,
      },
      tiktok: {
        configured: Boolean(this.config.get('TIKTOK_CLIENT_KEY')),
        callbackUrl: `${getAppBaseUrl(this.config)}/api/social-accounts/auth/tiktok/callback`,
      },
    };
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  google() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: any) {
    return this.handleOauthRedirect(req, res);
  }

  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  facebook() {}

  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Req() req: any, @Res() res: any) {
    return this.handleOauthRedirect(req, res);
  }

  @Public()
  @Get('oauth-failed')
  oauthFailed(@Req() req: any, @Res() res: any) {
    const front = getFrontendUrl(this.config);
    const reason =
      req.query?.error ||
      req.query?.error_description ||
      req.query?.error_reason ||
      'Login gagal. Silakan coba lagi.';
    return res.redirect(`${front}/auth/login?error=${encodeURIComponent(String(reason))}`);
  }

  @Public()
  @Get('oauth/exchange')
  oauthExchange(@Query('code') code: string) {
    const session = this.auth.consumeOauthSession(code);
    if (!session) {
      throw new BadRequestException('Kode OAuth tidak valid atau sudah kedaluwarsa');
    }
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      channels: session.channels ?? [],
    };
  }

  private handleOauthRedirect(req: any, res: any) {
    const tokens = req.user;
    const front = getFrontendUrl(this.config);
    const channels = Array.isArray(tokens.channels) ? tokens.channels : [];
    const code = this.auth.createOauthSession(
      { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
      channels,
    );
    res.redirect(`${front}/auth/oauth/callback?code=${code}`);
  }
}