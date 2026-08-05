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
      // Request offline access + the same scopes as the account-connect flow
      // (upload + force-ssl) so a Google login can also refresh the tokens of
      // already-connected YouTube accounts without a second OAuth round-trip.
      accessType: 'offline',
      includeGrantedScopes: true,
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.force-ssl',
      ],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const result = await this.auth.googleValidate(profile, accessToken, refreshToken);
    done(null, result);
  }
}