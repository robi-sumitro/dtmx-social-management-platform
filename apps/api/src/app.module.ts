import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

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
      useFactory: (c: ConfigService) => [
        {
          rootPath: join(process.cwd(), c.get('UPLOAD_DIR', 'uploads')),
          serveRoot: '/uploads',
          exclude: ['/api*'],
        },
      ],
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