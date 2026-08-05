import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { getAppBaseUrl } from '../../common/app-url';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService, private readonly auth: AuthService) {
    super({
      clientID: config.get<string>('FACEBOOK_APP_ID', ''),
      clientSecret: config.get<string>('FACEBOOK_APP_SECRET', ''),
      callbackURL: `${getAppBaseUrl(config)}/api/auth/facebook/callback`,
      // Minimal, always-available login permissions. `pages_show_list` (halaman)
      // diminta lewat alur "hubungkan akun" terpisah, bukan saat login —
      // menghindari penolakan dialog OAuth oleh Meta untuk app yang belum review.
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
      graphAPIVersion: 'v24.0',
      // This API is stateless (JWT auth, no express-session), so passport's
      // OAuth `state` parameter cannot be validated — disable it to avoid
      // "requires session support when using state".
      state: false,
      failureRedirect: `${getAppBaseUrl(config)}/api/auth/oauth-failed`,
    });
  }

  async validate(accessToken: string, _rt: string, profile: Profile, done: any): Promise<any> {
    try {
      const result = await this.auth.facebookValidate(profile, accessToken);
      done(null, result);
    } catch (err) {
      done(err instanceof Error ? err : new UnauthorizedException('Login Facebook gagal'), null);
    }
  }
}