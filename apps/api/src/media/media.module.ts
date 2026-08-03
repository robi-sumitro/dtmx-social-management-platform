import { Module } from '@nestjs/common';
import { FileStorageService, MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  controllers: [MediaController],
  providers: [FileStorageService, MediaService],
  exports: [FileStorageService, MediaService],
})
export class MediaModule {}