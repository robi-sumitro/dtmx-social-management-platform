import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import axios from 'axios';
import { AppModule } from './app.module';
import { getAppBaseUrl, getFrontendUrl } from './common/app-url';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
        },
      },
    }),
  );

  const rawOrigins = config.get<string>('CORS_ORIGINS', '');
  const origins = rawOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

  // Surface the real platform error (e.g. Meta Graph API `error.message`)
  // instead of a generic "Request failed with status code 400". This keeps
  // post/inbox/analytics failures actionable for the user.
  axios.interceptors.response.use(
    (res) => res,
    (error) => {
      if (axios.isAxiosError(error) && error.response) {
        const body: any = error.response.data;
        const platformMsg =
          body?.error?.message ||
          body?.message ||
          (typeof body === 'string' ? body : undefined);
        if (platformMsg) {
          error.message = `${platformMsg} (HTTP ${error.response.status})`;
        }
      }
      return Promise.reject(error);
    },
  );

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  const base = getAppBaseUrl(config);
  logger.log(`DtmX API running on http://localhost:${port}/api`);
  logger.log(`API base URL : ${base}`);
  logger.log(`Frontend URL : ${getFrontendUrl(config)}`);
  logger.log(`Google callback  : ${base}/api/auth/google/callback`);
  logger.log(`Facebook callback: ${base}/api/auth/facebook/callback`);
}

bootstrap();