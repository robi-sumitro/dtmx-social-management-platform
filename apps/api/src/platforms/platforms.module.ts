import { Module } from '@nestjs/common';
import { PlatformsService } from './platforms.service';
import { FacebookProvider } from './providers/facebook.provider';
import { InstagramProvider } from './providers/instagram.provider';
import { YoutubeProvider } from './providers/youtube.provider';
import { TiktokProvider } from './providers/tiktok.provider';
import { SimulatedProvider } from './providers/simulated.provider';

@Module({
  providers: [
    PlatformsService,
    FacebookProvider,
    InstagramProvider,
    YoutubeProvider,
    TiktokProvider,
    SimulatedProvider,
  ],
  exports: [PlatformsService],
})
export class PlatformsModule {}