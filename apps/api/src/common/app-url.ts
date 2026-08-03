import type { ConfigService } from '@nestjs/config';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getAppBaseUrl(config: ConfigService): string {
  const fromEnv = (config.get<string>('API_URL') ?? '').trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  const railwayDomain = (config.get<string>('RAILWAY_PUBLIC_DOMAIN') ?? '').trim();
  if (railwayDomain) {
    return `https://${railwayDomain.replace(/^https?:\/\//, '')}`;
  }
  return 'http://localhost:3000';
}

export function getFrontendUrl(config: ConfigService): string {
  const fromEnv = (config.get<string>('FRONTEND_URL') ?? '').trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  return getAppBaseUrl(config);
}
