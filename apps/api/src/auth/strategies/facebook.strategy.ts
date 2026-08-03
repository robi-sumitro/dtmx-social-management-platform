import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService, private readonly auth: AuthService) {
    super({
      clientID: config.get<string>('FACEBOOK_APP_ID', ''),
      clientSecret: config.get<string>('FACEBOOK_APP_SECRET', ''),
      callbackURL: `${config.get('API_URL', 'http://localhost:3000')}/api/auth/facebook/callback`,
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
    });
  }

  async validate(_at: string, _rt: string, profile: Profile, done: any): Promise<any> {
    const result = await this.auth.facebookValidate(profile);
    done(null, result);
  }
}