import { Controller, Get } from '@nestjs/common';
import { FeatureFlagService } from './features/feature-flag.service';
import { Public } from './common/decorators/auth.decorators';

@Controller()
export class AppController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'DtmX API', time: new Date().toISOString() };
  }

  @Public()
  @Get('flags')
  getFlags() {
    return this.flags.findAll();
  }
}