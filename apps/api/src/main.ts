import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { getAppBaseUrl, getFrontendUrl } from './common/app-url';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS', '*')
      .split(',')
      .map((s) => s.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.setGlobalPrefix('api');

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