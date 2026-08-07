import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { FeatureFlagService } from '../features/feature-flag.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get('summary')
  async summary(@CurrentUser('id') userId: string) {
    await this.flags.assertEnabled('analytics');
    return this.analytics.summary(userId);
  }
}
