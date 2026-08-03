import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AIProvider } from '@dtmx/shared';
import { AISettingsService } from './ai-settings.service';

export interface AICompletion {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIAdapter {
  provider: AIProvider;
  complete(prompt: string, opts?: any): Promise<AICompletion>;
}

@Injectable()
export class OpenAiAdapter implements AIAdapter {
  provider: AIProvider = 'openai';
  private logger = new Logger(OpenAiAdapter.name);
  constructor(private readonly settings: AISettingsService) {}
  async complete(prompt: string, opts?: any) {
    const key = this.settings.getApiKey('openai');
    if (!key) throw new Error('OpenAI API key belum dikonfigurasi di Admin > AI');
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.settings.getModel('openai'),
        messages: [{ role: 'user', content: prompt }],
        temperature: opts?.temperature ?? 0.7,
        max_tokens: opts?.maxTokens ?? 300,
      },
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const d = res.data;
    return {
      content: d.choices?.[0]?.message?.content ?? '',
      inputTokens: d.usage?.prompt_tokens ?? 0,
      outputTokens: d.usage?.completion_tokens ?? 0,
    };
  }
}

@Injectable()
export class AnthropicAdapter implements AIAdapter {
  provider: AIProvider = 'anthropic';
  constructor(private readonly settings: AISettingsService) {}
  private tokenLength(s: string) { return Math.ceil(s.length / 4); }
  async complete(prompt: string, opts?: any) {
    const key = this.settings.getApiKey('anthropic');
    if (!key) throw new Error('Anthropic API key belum dikonfigurasi di Admin > AI');
    const res = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: this.settings.getModel('anthropic'), max_tokens: opts?.maxTokens ?? 300, messages: [{ role: 'user', content: prompt }] },
      { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } },
    );
    const text = res.data?.content?.[0]?.text ?? '';
    return { content: text, inputTokens: this.tokenLength(prompt), outputTokens: this.tokenLength(text) };
  }
}

@Injectable()
export class GeminiAdapter implements AIAdapter {
  provider: AIProvider = 'gemini';
  constructor(private readonly settings: AISettingsService) {}
  async complete(prompt: string, opts?: any) {
    const key = this.settings.getApiKey('gemini');
    if (!key) throw new Error('Gemini API key belum dikonfigurasi di Admin > AI');
    const model = this.settings.getModel('gemini');
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { contents: [{ parts: [{ text: prompt }] }] },
    );
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { content: text, inputTokens: 0, outputTokens: 0 };
  }
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private adapters: Record<string, AIAdapter> = {};
  constructor(
    private readonly settings: AISettingsService,
    openai: OpenAiAdapter,
    anthropic: AnthropicAdapter,
    gemini: GeminiAdapter,
  ) {
    this.adapters['openai'] = openai;
    this.adapters['anthropic'] = anthropic;
    this.adapters['gemini'] = gemini;
  }

  get activeProvider(): string {
    return this.settings.getActiveProvider();
  }

  async complete(prompt: string, opts?: any, provider?: string): Promise<AICompletion> {
    const p = provider || this.activeProvider;
    const adapter = this.adapters[p];
    if (!adapter) throw new Error(`AI provider "${p}" tidak terdaftar`);
    this.logger.log(`AI call via ${p}`);
    return adapter.complete(prompt, opts);
  }
}
