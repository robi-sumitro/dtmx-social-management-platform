import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { BulkProcessor } from './bulk.processor';
import { EmailProcessor } from './processors/email.processor';
import { RepliesProcessor } from './processors/replies.processor';
import { PublishingProcessor } from './processors/publishing.processor';
import { SyncProcessor } from './processors/sync.processor';
import { PlatformsModule } from '../platforms/platforms.module';
import { EmailModule } from '../auth/email.module';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';

const connection = (config: ConfigService) => ({
  host: config.get<string>('REDIS_HOST', 'localhost'),
  port: config.get<number>('REDIS_PORT', 6379),
  password: config.get<string>('REDIS_PASSWORD', ''),
  maxRetriesPerRequest: null,
});

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        connection: connection(c),
        defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 500 },
      }),
    }),
    BullModule.registerQueue(
      { name: 'replies' },
      { name: 'publishing' },
      { name: 'emails' },
      { name: 'sync' },
    ),
    PlatformsModule,
    EmailModule,
    SocialAccountsModule,
  ],
  providers: [BulkProcessor, EmailProcessor, RepliesProcessor, PublishingProcessor, SyncProcessor],
  exports: [BulkProcessor],
})
export class QueueModule {}