import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { QueueModule } from '../queue/queue.module';
import { SecurityModule } from '../common/security.module';

@Module({
  imports: [QueueModule, SecurityModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}