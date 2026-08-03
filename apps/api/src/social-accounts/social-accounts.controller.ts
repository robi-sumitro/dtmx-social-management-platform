import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialAccountsService } from './social-accounts.service';
import { SocialOAuthService } from './social-oauth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, Public } from '../common/decorators/auth.decorators';
import { getFrontendUrl } from '../common/app-url';

@Controller('social-accounts')
@UseGuards(JwtAuthGuard)
export class SocialAccountsController {
  constructor(
    private readonly svc: SocialAccountsService,
    private readonly oauth: SocialOAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.svc.list(userId);
  }

  @Post('connect')
  connect(@Body() body: any, @CurrentUser('id') userId: string) {
    return this.svc.connect(userId, body);
  }

  @Patch('refresh')
  refresh(@CurrentUser('id') userId: string) {
    return this.svc.refreshTokenAll(userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.remove(userId, id);
  }

  @Get('auth/:provider/url')
  authUrl(@Param('provider') provider: string, @CurrentUser('id') userId: string) {
    return { url: this.oauth.getAuthorizeUrl(provider, userId) };
  }

  @Public()
  @Get('auth/:provider/callback')
  async authCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string,
    @Query('error_description') errorDescription: string,
    @Res() res: any,
  ) {
    const front = getFrontendUrl(this.config);
    if (oauthError) {
      const message = encodeURIComponent(errorDescription || oauthError || 'Autentikasi dibatalkan');
      return res.redirect(`${front}/app/accounts?error=${message}`);
    }
    try {
      const url = await this.oauth.handleCallback(provider, code, state);
      return res.redirect(url);
    } catch (err) {
      const message = encodeURIComponent(err instanceof Error ? err.message : 'Gagal menghubungkan akun');
      return res.redirect(`${front}/app/accounts?error=${message}`);
    }
  }
}
