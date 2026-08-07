import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BulkProcessor {
  constructor(
    @InjectQueue('replies') private replies: Queue,
    @InjectQueue('publishing') private publishing: Queue,
    @InjectQueue('emails') private emails: Queue,
    @InjectQueue('sync') private sync: Queue,
  ) {}

  async enqueueReply(data: { inboxId: string; accountId: string; text: string }) {
    return this.replies.add('send', data, { attempts: 3, backoff: { type: 'exponential', delay: 4000 } });
  }

  async enqueuePublish(data: { postId: string }, delayMs?: number) {
    return this.publishing.add('publish', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      delay: delayMs && delayMs > 0 ? delayMs : undefined,
    });
  }

  async enqueueEmail(data: { to: string; subject: string; html: string }) {
    return this.emails.add('send', data);
  }

  async enqueueAccountSync(data: {
    action: 'refresh_tokens' | 'pull_inbox';
    accountId?: string;
    attempts?: number;
  }) {
    // Retry transient failures (API blips, rate limit, etc.) so every account
    // eventually gets its inbox pulled even if a single pull fails once.
    return this.sync.add(data.action, data, {
      attempts: data.attempts ?? 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 200,
    });
  }
}