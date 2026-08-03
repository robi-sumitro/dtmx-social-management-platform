import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaymentsModule } from '../payments/payments.module';
import { SecurityModule } from '../common/security.module';

@Module({
  imports: [SubscriptionsModule, PaymentsModule, SecurityModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}