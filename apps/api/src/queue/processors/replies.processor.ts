import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformsService } from '../../platforms/platforms.service';

@Processor('replies')
export class RepliesProcessor extends WorkerHost {
  private readonly logger = new Logger(RepliesProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly platforms: PlatformsService,
  ) {
    super();
  }
  async process(job: Job): Promise<any> {
    const { inboxId, accountId, text } = job.data;
    this.logger.log(`Sending reply for inbox ${inboxId} on account ${accountId}`);

    const inbox = await this.prisma.inboxItem.findUnique({ where: { id: inboxId } });
    const account = await this.prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!inbox || !account) return { skipped: true, reason: 'inbox/account missing' };

    const sent = await this.platforms.reply(account, {
      text,
      authorId: inbox.authorId,
      targetId: inbox.sourceId,
    });

    await this.prisma.inboxItem.update({
      where: { id: inboxId },
      data: { status: sent ? 'replied' : 'queued', repliedAt: sent ? new Date() : undefined },
    });
    return { ok: sent, text };
  }
}