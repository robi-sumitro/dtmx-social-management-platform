import { Global, Module } from '@nestjs/common';
import { QuotaGuardService } from './quota-guard.service';

@Global()
@Module({
  providers: [QuotaGuardService],
  exports: [QuotaGuardService],
})
export class QuotaModule {}
