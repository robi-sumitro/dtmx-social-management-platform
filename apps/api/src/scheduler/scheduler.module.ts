import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledJobsService } from './scheduled-jobs.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ScheduledJobsService],
})
export class SchedulerModule {}