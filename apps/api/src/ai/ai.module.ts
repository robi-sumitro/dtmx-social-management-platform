import { Module } from '@nestjs/common';
import { AIService, OpenAiAdapter, AnthropicAdapter, GeminiAdapter } from './ai.service';
import { AISettingsService } from './ai-settings.service';
import { AIController } from './ai.controller';
import { SecurityModule } from '../common/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [AIController],
  providers: [AIService, OpenAiAdapter, AnthropicAdapter, GeminiAdapter, AISettingsService],
  exports: [AIService, AISettingsService],
})
export class AIModule {}