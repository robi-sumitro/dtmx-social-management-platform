import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { AuthService } from '../auth.service';
import { getAppBaseUrl } from '../../common/app-url';

/**
 * Stateless OAuth `state` store. This API is JWT-based (no express-session),
 * so passport's built-in session-backed state store cannot be used. Instead we
 * sign the state with an HMAC and verify the signature on the callback — this
 * keeps CSRF protection from the `state` parameter without any session.
 */
function createStatelessStateStore(secret: string) {
  const sign = (value: string) => createHmac('sha256', secret).update(value).digest('hex');

  return {
    // arity (req, cb): generate a self-contained signed state token
    store(req: any, cb: (err: any, state?: string) => void) {
      const payload = `${Date.now()}:${randomBytes(24).toString('hex')}`;
      cb(null, `${payload}.${sign(payload)}`);
    },
    // arity (req, providedState, cb): verify signature + freshness
    verify(req: any, providedState: string, cb: (err: any, ok?: boolean) => void) {
      const dot = providedState?.lastIndexOf('.');
      if (!providedState || !dot || dot <= 0) {
        return cb(null, false);
      }
      const payload = providedState.slice(0, dot);
      const sig = providedState.slice(dot + 1);
      const expected = Buffer.from(sign(payload), 'hex');
      const actual = Buffer.from(sig, 'hex');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        return cb(null, false);
      }
      const ts = Number(payload.split(':')[0]);
      if (!Number.isFinite(ts) || Date.now() - ts > 10 * 60 * 1000) {
        return cb(null, false);
      }
      return cb(null, true);
    },
  };
}

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService, private readonly auth: AuthService) {
    const callbackURL = `${getAppBaseUrl(config)}/api/auth/facebook/callback`;
    super({
      clientID: config.get<string>('FACEBOOK_APP_ID', ''),
      clientSecret: config.get<string>('FACEBOOK_APP_SECRET', ''),
      callbackURL,
      // Minimal, always-available login permissions. `pages_show_list` (halaman)
      // diminta lewat alur "hubungkan akun" terpisah, bukan saat login —
      // menghindari penolakan dialog OAuth oleh Meta untuk app yang belum review.
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
      graphAPIVersion: 'v24.0',
      // Stateless signed `state` (no express-session) — keeps CSRF protection
      // while avoiding the "requires session support when using state" 500.
      store: createStatelessStateStore(
        config.get<string>('OAUTH_STATE_SECRET') || config.get<string>('JWT_SECRET', '') || 'dtmx-oauth-state',
      ),
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
