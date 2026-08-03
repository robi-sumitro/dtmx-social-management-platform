import { Module } from '@nestjs/common';
import { AutoRepliesService } from './auto-replies.service';
import { AutoRepliesController } from './auto-replies.controller';
import { SecurityModule } from '../common/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [AutoRepliesController],
  providers: [AutoRepliesService],
  exports: [AutoRepliesService],
})
export class AutoRepliesModule {}
