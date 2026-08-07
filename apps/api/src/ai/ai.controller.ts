import { Body, Controller, Get, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { AIService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagService } from '../features/feature-flag.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly ai: AIService,
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get('status')
  async status(@CurrentUser('id') userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
    });
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const used = await this.prisma.aiUsage.count({
      where: { userId, createdAt: { gte: since } },
    });
    return {
      provider: this.ai.activeProvider,
      quota: sub?.plan?.aiPerMonth || 0,
      used,
      remaining: Math.max(0, (sub?.plan?.aiPerMonth || 0) - used),
      limitReached: used >= (sub?.plan?.aiPerMonth ?? 0),
    };
  }

  @Post('generate')
  async generate(
    @CurrentUser('id') userId: string,
    @Body() body: { prompt: string; feature?: string; provider?: string },
  ) {
    await this.flags.assertEnabled('ai_caption');
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
    });
    const quota = sub?.plan?.aiPerMonth || 0;

    const usage = await this.prisma.$transaction(async (tx) => {
      // Serialize quota checks per user with a row lock to prevent over-quota races.
      await tx.$queryRaw`SELECT id FROM subscriptions WHERE id = ${sub?.id} FOR UPDATE`;

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const used = await tx.aiUsage.count({
        where: { userId, createdAt: { gte: since } },
      });
      if (used >= quota) {
        throw new BadRequestException('Kuota AI bulanan sudah habis. Upgrade paket atau tunggu reset kuota.');
      }

      const result = await this.ai.complete(
        body.prompt,
        { feature: body.feature || 'content_writer' },
        body.provider,
      );
      return tx.aiUsage.create({
        data: {
          userId,
          feature: body.feature || 'content_writer',
          provider: body.provider || this.ai.activeProvider,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          prompt: body.prompt.slice(0, 2000),
          result: result.content.slice(0, 5000),
        },
      });
    });

    const content = typeof (usage as any).result === 'string' ? (usage as any).result : '';
    return { content };
  }
}