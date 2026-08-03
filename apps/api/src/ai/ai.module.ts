import { Module } from '@nestjs/common';
import { AIService, OpenAiAdapter, AnthropicAdapter, GeminiAdapter } from './ai.service';
import { AIController } from './ai.controller';

@Module({
  controllers: [AIController],
  providers: [AIService, OpenAiAdapter, AnthropicAdapter, GeminiAdapter],
  exports: [AIService],
})
export class AIModule {}