import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Post } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformsService } from '../../platforms/platforms.service';
import { PublishContext } from '../../platforms/platform.types';
import { NotificationsService } from '../../notifications/notifications.service';
import { getAppBaseUrl } from '../../common/app-url';

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
    private readonly notifications: NotificationsService,
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

    // Public, Google/TikTok-reachable URL to the media files. Must be an absolute
    // URL derived from the same base as the OAuth callbacks (API_URL /
    // RAILWAY_PUBLIC_DOMAIN), otherwise the platform's downloader cannot fetch it.
    const mediaBaseUrl = `${getAppBaseUrl(this.config)}/uploads`;
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

    // Jika sebagian akun berhasil dan sebagian gagal, tandai 'partial' — bukan
    // 'published' — supaya kartu tidak bicara "Terbit" padahal ada yang gagal.
    const finalStatus =
      published === 0
        ? 'failed'
        : errors.length > 0
          ? 'partial'
          : 'published';

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: finalStatus,
        publishedAt: published > 0 ? new Date() : undefined,
        errorMessage: errors.length ? errors.join('; ') : null,
        retryCount: { increment: errors.length ? 1 : 0 },
      },
    });

    const title =
      finalStatus === 'published'
        ? 'Postingan terbit'
        : finalStatus === 'partial'
          ? 'Sebagian postingan gagal'
          : 'Postingan gagal diterbitkan';
    const message =
      finalStatus === 'published'
        ? `"${post.caption?.slice(0, 80) || post.title || 'Postingan'}" berhasil diterbitkan ke ${published} platform.`
        : finalStatus === 'partial'
          ? `Diterbitkan ke ${published} platform, namun gagal di: ${errors.join('; ')}`
          : errors.join('; ') || 'Terjadi kesalahan saat menerbitkan postingan.';

    await this.notifications.create({
      userId: post.userId,
      type: 'post',
      title,
      message,
      link: `/app/posts/${postId}`,
      data: { postId, status: finalStatus },
    });

    if (finalStatus === 'failed') {
      throw new Error(`Publishing failed: ${errors.join('; ')}`);
    }
    return { ok: true, publishedTo: published, failed: errors.length, status: finalStatus };
  }
}