import { Injectable } from '@nestjs/common';
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
      scope: ['email', 'public_profile', 'pages_show_list'],
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
      graphAPIVersion: 'v24.0',
    });
  }

  async validate(accessToken: string, _rt: string, profile: Profile, done: any): Promise<any> {
    const result = await this.auth.facebookValidate(profile, accessToken);
    done(null, result);
  }
}