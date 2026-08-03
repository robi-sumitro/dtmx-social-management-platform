import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AIProvider } from '@dtmx/shared';

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
  constructor(private config: ConfigService) {}
  async complete(prompt: string, opts?: any) {
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key) throw new Error('OPENAI_API_KEY tidak dikonfigurasi');
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
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
  constructor(private config: ConfigService) {}
  private tokenLength(s: string) { return Math.ceil(s.length / 4); }
  async complete(prompt: string, opts?: any) {
    const key = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!key) throw new Error('ANTHROPIC_API_KEY tidak dikonfigurasi');
    const res = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: this.config.get<string>('ANTHROPIC_MODEL', 'claude-3-5-haiku-latest'), max_tokens: opts?.maxTokens ?? 300, messages: [{ role: 'user', content: prompt }] },
      { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } },
    );
    const text = res.data?.content?.[0]?.text ?? '';
    return { content: text, inputTokens: this.tokenLength(prompt), outputTokens: this.tokenLength(text) };
  }
}

@Injectable()
export class GeminiAdapter implements AIAdapter {
  provider: AIProvider = 'gemini';
  constructor(private config: ConfigService) {}
  async complete(prompt: string, opts?: any) {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY tidak dikonfigurasi');
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-1.5-flash');
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
    private config: ConfigService,
    openai: OpenAiAdapter,
    anthropic: AnthropicAdapter,
    gemini: GeminiAdapter,
  ) {
    this.adapters['openai'] = openai;
    this.adapters['anthropic'] = anthropic;
    this.adapters['gemini'] = gemini;
  }

  get activeProvider(): string {
    return this.config.get<string>('AI_PROVIDER', 'openai');
  }

  async complete(prompt: string, opts?: any, provider?: string): Promise<AICompletion> {
    const p = provider || this.activeProvider;
    const adapter = this.adapters[p];
    if (!adapter) throw new Error(`AI provider "${p}" tidak terdaftar`);
    this.logger.log(`AI call via ${p}`);
    return adapter.complete(prompt, opts);
  }
}