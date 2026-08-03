import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AutoRepliesService } from './auto-replies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('auto-replies')
@UseGuards(JwtAuthGuard)
export class AutoRepliesController {
  constructor(private readonly svc: AutoRepliesService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.svc.list(userId);
  }

  @Post()
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    return this.svc.create(userId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    return this.svc.update(userId, id, body);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.toggle(userId, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.remove(userId, id);
  }
}
