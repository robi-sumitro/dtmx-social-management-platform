import {
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
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, RefreshTokenDto } from './dto/auth.dto';
import { Public, CurrentUser } from '../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { getAppBaseUrl, getFrontendUrl } from '../common/app-url';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
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

  private handleOauthRedirect(req: any, res: any) {
    const tokens = req.user;
    const front = getFrontendUrl(this.config);
    const query = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    res.redirect(`${front}/auth/oauth/callback?${query.toString()}`);
  }
}