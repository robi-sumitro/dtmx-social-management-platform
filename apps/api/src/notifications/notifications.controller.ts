import { Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { FeatureFlagService } from '../features/feature-flag.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get()
  async list(@CurrentUser('id') userId: string, @Query('limit') limit?: string) {
    await this.flags.assertEnabled('notifications');
    return this.notifications.listForUser(userId, limit ? Number(limit) : 50);
  }

  @Get('unread-count')
  unread(@CurrentUser('id') userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @Patch('read-all')
  readAll(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(':id/read')
  read(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notifications.markRead(userId, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notifications.remove(userId, id);
  }
}
