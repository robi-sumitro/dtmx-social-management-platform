import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';

import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './common/security.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { FeatureFlagsModule } from './features/feature-flags.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AIModule } from './ai/ai.module';
import { InboxModule } from './inbox/inbox.module';
import { AutoRepliesModule } from './auto-replies/auto-replies.module';
import { SocialAccountsModule } from './social-accounts/social-accounts.module';
import { PostsModule } from './posts/posts.module';
import { MediaModule } from './media/media.module';
import { AdminModule } from './admin/admin.module';
import { QueueModule } from './queue/queue.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { PlatformsModule } from './platforms/platforms.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 60),
          },
        ],
      }),
    }),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => {
        const uploads = join(process.cwd(), c.get('UPLOAD_DIR', 'uploads'));
        // Resolve the built web frontend (apps/web/dist) relative to cwd
        // (apps/api when run via pnpm, or repo root) — whichever exists.
        const webDist =
          (existsSync(join(process.cwd(), '..', 'web', 'dist')) &&
            join(process.cwd(), '..', 'web', 'dist')) ||
          (existsSync(join(process.cwd(), 'apps', 'web', 'dist')) &&
            join(process.cwd(), 'apps', 'web', 'dist')) ||
          undefined;
        const options: any[] = [
          {
            rootPath: uploads,
            serveRoot: '/uploads',
            exclude: ['/api/(.*)'],
          },
        ];
        // Serve the built web frontend (Vite SPA) when it exists.
        if (webDist) {
          options.push({
            rootPath: webDist,
            renderPath: '*',
            exclude: ['/api/(.*)', '/uploads/(.*)'],
          });
        }
        return options;
      },
    }),
    PrismaModule,
    FeatureFlagsModule,
    AuthModule,
    UsersModule,
    PaymentsModule,
    SubscriptionsModule,
    AIModule,
    InboxModule,
    AutoRepliesModule,
    SocialAccountsModule,
    PostsModule,
    MediaModule,
    AdminModule,
    NotificationsModule,
    QueueModule,
    SchedulerModule,
    PlatformsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}