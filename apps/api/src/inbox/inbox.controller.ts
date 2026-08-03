import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InboxService } from './inbox.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
    @Query('accountId') accountId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inbox.list(userId, {
      status,
      accountId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post(':id/reply')
  reply(
    @Param('id') id: string,
    @Body() body: { text?: string; useAI?: boolean },
    @CurrentUser('id') userId: string,
  ) {
    return this.inbox.reply(userId, id, body.text || '', body.useAI);
  }

  @Post(':id/auto-reply')
  autoReply(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.inbox.autoReply(userId, id);
  }

  @Patch(':id/status')
  mark(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.inbox.mark(userId, id, body.status);
  }
}