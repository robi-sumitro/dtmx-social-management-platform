import { Module } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service';
import { SocialOAuthService } from './social-oauth.service';
import { SocialAccountsController } from './social-accounts.controller';
import { SecurityModule } from '../common/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService, SocialOAuthService],
  exports: [SocialAccountsService],
})
export class SocialAccountsModule {}