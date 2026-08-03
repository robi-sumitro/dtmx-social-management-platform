import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Post } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformsService } from '../../platforms/platforms.service';
import { PublishContext } from '../../platforms/platform.types';

type PostWithMedia = Post & {
  media: { media: { filename: string; fileType: string; mimeType: string | null } }[];
};

@Processor('publishing')
export class PublishingProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishingProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: PlatformsService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { postId } = job.data;
    this.logger.log(`Publishing post ${postId}`);
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { media: { include: { media: true } } },
    });
    // publishNow sets 'publishing' before enqueue; schedule leaves 'scheduled'.
    if (!post || (post.status !== 'scheduled' && post.status !== 'publishing')) {
      return { skipped: true };
    }

    await this.prisma.post.update({ where: { id: postId }, data: { status: 'publishing' } });

    const accounts = await this.prisma.postAccount.findMany({
      where: { postId },
      include: { account: true },
    });

    const mediaBaseUrl = this.config.get<string>('APP_URL', 'http://localhost:3000') + '/uploads';
    const ctx: PublishContext = {
      caption: post.caption,
      hashtags: post.hashtags,
      title: post.title,
      postType: post.postType,
      media: (post as PostWithMedia).media.map((m) => m.media),
      mediaBaseUrl,
    };

    let published = 0;
    const errors: string[] = [];
    for (const pa of accounts) {
      try {
        const remoteId = await this.provider.publish(pa.account, ctx);
        await this.prisma.postPublication.create({
          data: { postId, accountId: pa.accountId, remoteId: remoteId ?? null },
        });
        published++;
      } catch (e) {
        const err = e as Error;
        this.logger.error(`Publish failed for account ${pa.accountId}: ${err.message}`);
        errors.push(`${pa.account.accountName}: ${err.message}`);
      }
    }

    const finalStatus = published === 0 ? 'failed' : 'published';
    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: finalStatus,
        publishedAt: new Date(),
        errorMessage: errors.length ? errors.join('; ') : null,
        retryCount: { increment: errors.length ? 1 : 0 },
      },
    });

    if (finalStatus === 'failed') {
      throw new Error(`Publishing failed: ${errors.join('; ')}`);
    }
    return { ok: true, publishedTo: published, failed: errors.length };
  }
}