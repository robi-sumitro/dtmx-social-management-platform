import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BulkProcessor } from '../queue/bulk.processor';

export interface CreatePostInput {
  title?: string;
  caption?: string;
  hashtags?: string;
  postType?: string;
  accountIds?: string[];
  mediaIds?: string[];
  scheduledAt?: string;
  allowRepost?: boolean;
  overrides?: any;
  action?: 'draft' | 'schedule' | 'publish_now';
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bulk: BulkProcessor,
  ) {}

  async create(userId: string, input: CreatePostInput) {
    const accountIds = input.accountIds || [];
    const mediaIds = input.mediaIds || [];
    const plan = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
    });
    const limit = plan?.plan?.maxPostsPerMonth || 10;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const used = await this.prisma.post.count({
      where: { userId, createdAt: { gte: since } },
    });
    if (used >= limit) {
      throw new BadRequestException('Batas jumlah posting bulanan tercapai');
    }

    const post = await this.prisma.post.create({
      data: {
        userId,
        title: input.title,
        caption: input.caption,
        hashtags: input.hashtags,
        postType: input.postType || 'text',
        platform: await this.derivePlatform(accountIds),
        status: 'draft',
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        overrides: input.overrides ?? undefined,
        allowRepost: input.allowRepost ?? false,
        accounts: { create: accountIds.map((id) => ({ accountId: id })) },
        media: { create: mediaIds.map((id, i) => ({ mediaId: id, order: i })) },
      },
      include: { accounts: true, media: true },
    });

    if (input.action === 'schedule') {
      await this.schedule(post.id);
    } else if (input.action === 'publish_now') {
      await this.publishNow(post.id);
    }

    return post;
  }

  async list(userId: string, status?: string) {
    return this.prisma.post.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: { accounts: { include: { account: true } }, media: { include: { media: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(userId: string, id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, userId },
      include: { accounts: { include: { account: true } }, media: { include: { media: true } } },
    });
    if (!post) throw new NotFoundException('Postingan tidak ditemukan');
    return post;
  }

  async update(userId: string, id: string, input: CreatePostInput) {
    const existing = await this.prisma.post.findFirst({
      where: { id, userId },
      include: { accounts: true, media: true },
    });
    if (!existing) throw new NotFoundException('Postingan tidak ditemukan');

    const accountIds = input.accountIds ?? existing.accounts?.map((a) => a.accountId) ?? [];
    const mediaIds = input.mediaIds ?? existing.media?.map((m) => m.mediaId) ?? [];

    const post = await this.prisma.$transaction(async (tx) => {
      await tx.postAccount.deleteMany({ where: { postId: id } });
      await tx.postMedia.deleteMany({ where: { postId: id } });
      return tx.post.update({
        where: { id },
        data: {
          title: input.title ?? existing.title,
          caption: input.caption ?? existing.caption,
          hashtags: input.hashtags ?? existing.hashtags,
          postType: input.postType ?? existing.postType,
          platform: await this.derivePlatform(accountIds),
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : input.scheduledAt === null ? null : existing.scheduledAt,
          allowRepost: input.allowRepost ?? existing.allowRepost,
          overrides: input.overrides ?? existing.overrides,
          accounts: { create: accountIds.map((accountId) => ({ accountId })) },
          media: { create: mediaIds.map((mediaId, order) => ({ mediaId, order })) },
        },
        include: { accounts: { include: { account: true } }, media: { include: { media: true } } },
      });
    });

    if (input.action === 'schedule') {
      await this.schedule(post.id);
    } else if (input.action === 'publish_now') {
      await this.publishNow(post.id);
    }

    return post;
  }

  private async derivePlatform(accountIds: string[]) {
    if (!accountIds || accountIds.length === 0) return undefined;
    const accounts = await this.prisma.socialAccount.findMany({
      where: { id: { in: accountIds } },
      select: { provider: true },
    });
    const providers = new Set(accounts.map((a) => a.provider));
    if (providers.has('youtube') || providers.has('tiktok')) return 'all';
    if (providers.has('facebook') && providers.has('instagram')) return 'both';
    if (providers.has('facebook')) return 'facebook';
    if (providers.has('instagram')) return 'instagram';
    return 'all';
  }

  async cancel(userId: string, id: string) {
    return this.prisma.post.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async delete(userId: string, id: string) {
    const post = await this.prisma.post.findFirst({ where: { id, userId } });
    if (!post) throw new NotFoundException('Postingan tidak ditemukan');
    await this.prisma.$transaction([
      this.prisma.postAccount.deleteMany({ where: { postId: id } }),
      this.prisma.postMedia.deleteMany({ where: { postId: id } }),
      this.prisma.postPublication.deleteMany({ where: { postId: id } }),
      this.prisma.post.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  async schedule(id: string) {
    const post = await this.prisma.post.update({
      where: { id },
      data: { status: 'scheduled' },
      select: { scheduledAt: true },
    });
    const delay = post.scheduledAt && post.scheduledAt > new Date()
      ? post.scheduledAt.getTime() - Date.now()
      : 0;
    await this.bulk.enqueuePublish({ postId: id }, delay);
    return { id, status: 'scheduled' };
  }

  async publishNow(id: string) {
    await this.prisma.post.update({
      where: { id },
      data: { status: 'publishing' },
    });
    await this.bulk.enqueuePublish({ postId: id });
    return { id, status: 'publishing' };
  }

  async listAll() {
    return this.prisma.post.findMany({
      include: { user: { select: { email: true } }, accounts: { include: { account: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}