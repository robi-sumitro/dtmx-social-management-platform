import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [ScheduleModule.forRoot(), QueueModule],
  providers: [ScheduledJobsService],
})
export class SchedulerModule {}