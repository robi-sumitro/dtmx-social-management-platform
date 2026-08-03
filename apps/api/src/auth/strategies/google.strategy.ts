import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, private readonly auth: AuthService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID', ''),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET', ''),
      callbackURL: `${config.get('API_URL', 'http://localhost:3000')}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _at: string,
    _rt: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const result = await this.auth.googleValidate(profile);
    done(null, result);
  }
}