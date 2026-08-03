import { Injectable, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagService.name);
  private cache = new Map<string, boolean>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refresh();
  }

  async refresh() {
    const flags = await this.prisma.featureFlag.findMany();
    this.cache.clear();
    for (const f of flags) this.cache.set(f.key, f.enabled);
    this.logger.log(`Loaded ${flags.length} feature flags`);
  }

  async isEnabled(key: string): Promise<boolean> {
    if (this.cache.has(key)) return this.cache.get(key) as boolean;
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    const enabled = flag ? flag.enabled : true;
    this.cache.set(key, enabled);
    return enabled;
  }

  async assertEnabled(key: string): Promise<void> {
    if (!(await this.isEnabled(key))) {
      throw new ForbiddenException(`Feature disabled: ${key}`);
    }
  }

  async set(key: string, enabled: boolean): Promise<void> {
    await this.prisma.featureFlag.update({ where: { key }, data: { enabled } });
    this.cache.set(key, enabled);
  }

  async findAll() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }
}