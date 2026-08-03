import { Module } from '@nestjs/common';
import { FileStorageService, MediaService } from './media.service';
import { MediaController } from './media.controller';
import { SecurityModule } from '../common/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [MediaController],
  providers: [FileStorageService, MediaService],
  exports: [FileStorageService, MediaService],
})
export class MediaModule {}