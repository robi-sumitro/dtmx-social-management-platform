import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PaymentsModule } from '../payments/payments.module';
import { MediaModule } from '../media/media.module';
import { EmailModule } from '../auth/email.module';
import { SecurityModule } from '../common/security.module';

@Module({
  imports: [PaymentsModule, MediaModule, EmailModule, SecurityModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}