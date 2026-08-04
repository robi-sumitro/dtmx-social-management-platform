import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AIProvider, AI_PROVIDERS } from '@dtmx/shared';

interface AISettingDef {
  key: string;
  label: string;
  placeholder?: string;
  order: number;
  env?: string;
  default?: string;
}

const AI_SETTING_DEFS: AISettingDef[] = [
  { key: 'active_provider', label: 'Provider AI Aktif', placeholder: 'openai | anthropic | gemini', order: 1 },
  { key: 'openai_api_key', label: 'OpenAI API Key', placeholder: 'sk-...', order: 10, env: 'OPENAI_API_KEY' },
  { key: 'openai_model', label: 'OpenAI Model', placeholder: 'gpt-4o-mini', order: 11, env: 'OPENAI_MODEL', default: 'gpt-4o-mini' },
  { key: 'anthropic_api_key', label: 'Anthropic API Key', placeholder: 'sk-ant-...', order: 20, env: 'ANTHROPIC_API_KEY' },
  { key: 'anthropic_model', label: 'Anthropic Model', placeholder: 'claude-3-5-haiku-latest', order: 21, env: 'ANTHROPIC_MODEL', default: 'claude-3-5-haiku-latest' },
  { key: 'gemini_api_key', label: 'Gemini API Key', placeholder: 'AIza...', order: 30, env: 'GEMINI_API_KEY' },
  { key: 'gemini_model', label: 'Gemini Model', placeholder: 'gemini-1.5-flash', order: 31, env: 'GEMINI_MODEL', default: 'gemini-1.5-flash' },
];

@Injectable()
export class AISettingsService implements OnModuleInit {
  private readonly logger = new Logger(AISettingsService.name);
  private cache = new Map<string, string | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
    await this.refresh();
  }

  private async refresh() {
    const rows = await this.prisma.aiSetting.findMany();
    this.cache.clear();
    for (const r of rows) this.cache.set(r.key, r.value);
    this.logger.log(`Loaded ${rows.length} AI settings`);
  }

  /**
   * Effective value: DB setting takes precedence, then env var, then hardcoded default.
   */
  get(key: string): string | undefined {
    if (this.cache.has(key)) {
      const v = this.cache.get(key);
      if (v) return v;
    }
    const def = AI_SETTING_DEFS.find((d) => d.key === key);
    if (def?.env) {
      const env = this.config.get<string>(def.env);
      if (env) return env;
    }
    if (def?.default) return def.default;
    return undefined;
  }

  getActiveProvider(): AIProvider {
    const p = this.get('active_provider');
    return (AI_PROVIDERS as readonly string[]).includes(p ?? '') ? (p as AIProvider) : 'openai';
  }

  getApiKey(provider: AIProvider): string | undefined {
    return this.get(`${provider}_api_key`);
  }

  getModel(provider: AIProvider): string {
    return this.get(`${provider}_model`) ?? '';
  }

  /**
   * For the admin dashboard: only values stored in the DB (API keys typed there),
   * so credentials from env are never exposed through the API.
   */
  async findAll() {
    const rows = await this.prisma.aiSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return AI_SETTING_DEFS.map((d) => ({
      key: d.key,
      label: d.label,
      placeholder: d.placeholder,
      order: d.order,
      value: map.get(d.key) ?? null,
    }));
  }

  async upsert(key: string, value: string) {
    const def = AI_SETTING_DEFS.find((d) => d.key === key);
    if (!def) throw new BadRequestException(`Setting AI "${key}" tidak dikenal`);
    if (key === 'active_provider' && !(AI_PROVIDERS as readonly string[]).includes(value)) {
      throw new BadRequestException(`Provider AI "${value}" tidak valid`);
    }
    const row = await this.prisma.aiSetting.upsert({
      where: { key },
      update: { value, label: def.label, placeholder: def.placeholder, order: def.order },
      create: { key, value, label: def.label, placeholder: def.placeholder, order: def.order },
    });
    this.cache.set(key, value);
    return row;
  }

  private async ensureDefaults() {
    for (const d of AI_SETTING_DEFS) {
      await this.prisma.aiSetting.upsert({
        where: { key: d.key },
        update: { label: d.label, placeholder: d.placeholder, order: d.order },
        create: { key: d.key, value: null, label: d.label, placeholder: d.placeholder, order: d.order },
      });
    }
  }

  async fetchAvailableModels(provider: string, apiKey: string): Promise<string[]> {
    if (!apiKey) return [];
    try {
      if (provider === 'gemini') {
        return await this.fetchGeminiModels(apiKey);
      } else if (provider === 'openai') {
        return await this.fetchOpenAiModels(apiKey);
      } else if (provider === 'anthropic') {
        return this.getAnthropicModels();
      }
      return [];
    } catch (err) {
      this.logger.warn(`Failed to fetch models for ${provider}: ${(err as Error).message}`);
      return [];
    }
  }

  private async fetchGeminiModels(apiKey: string): Promise<string[]> {
    const { data } = await axios.get(
      'https://generativelanguage.googleapis.com/v1beta/models',
      { params: { key: apiKey } },
    );
    const models: string[] = data.models
      ?.map((m: any) => m.name?.replace('models/', '') as string)
      .filter((n: string) => n && n.startsWith('gemini'))
      .sort() ?? [];
    return models;
  }

  private async fetchOpenAiModels(apiKey: string): Promise<string[]> {
    const { data } = await axios.get('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const models: string[] = data.data
      ?.map((m: any) => m.id as string)
      .filter((id: string) => id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3'))
      .sort() ?? [];
    return models;
  }

  private getAnthropicModels(): string[] {
    return [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-5-haiku-latest',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
    ];
  }
}
