import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PlatformsModule } from '../platforms/platforms.module';
import { SecurityModule } from '../common/security.module';

@Module({
  imports: [PlatformsModule, SecurityModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
