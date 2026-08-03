import { Module } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { InboxController } from './inbox.controller';
import { AIModule } from '../ai/ai.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [AIModule, QueueModule],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}