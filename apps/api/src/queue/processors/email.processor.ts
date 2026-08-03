import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../auth/email.service';

@Processor('emails')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    super();
  }
  async process(job: Job): Promise<any> {
    const { to, subject, html } = job.data;
    this.logger.log(`Sending email to ${to}`);
    await this.email.send(to, subject, html);
    return { ok: true };
  }
}