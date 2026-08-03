import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';

import { PrismaModule } from './prisma/prisma.module';
import { FeatureFlagsModule } from './features/feature-flags.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AIModule } from './ai/ai.module';
import { InboxModule } from './inbox/inbox.module';
import { SocialAccountsModule } from './social-accounts/social-accounts.module';
import { PostsModule } from './posts/posts.module';
import { MediaModule } from './media/media.module';
import { AdminModule } from './admin/admin.module';
import { QueueModule } from './queue/queue.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { PlatformsModule } from './platforms/platforms.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
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
            exclude: ['/api*'],
          },
        ];
        // Serve the built web frontend (Vite SPA) when it exists.
        if (webDist) {
          options.push({
            rootPath: webDist,
            renderPath: '*',
            exclude: ['/api*', '/uploads*'],
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
    SocialAccountsModule,
    PostsModule,
    MediaModule,
    AdminModule,
    QueueModule,
    SchedulerModule,
    PlatformsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}