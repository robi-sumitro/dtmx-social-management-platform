import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { getAppBaseUrl } from '../../common/app-url';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, private readonly auth: AuthService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID', ''),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET', ''),
      callbackURL: `${getAppBaseUrl(config)}/api/auth/google/callback`,
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/youtube.readonly'],
    });
  }

  async validate(
    accessToken: string,
    _rt: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const result = await this.auth.googleValidate(profile, accessToken);
    done(null, result);
  }
}