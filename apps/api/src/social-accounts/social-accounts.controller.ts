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
import { SocialAccountsService } from './social-accounts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('social-accounts')
@UseGuards(JwtAuthGuard)
export class SocialAccountsController {
  constructor(private readonly svc: SocialAccountsService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.svc.list(userId);
  }

  @Post('connect')
  connect(@Body() body: any, @CurrentUser('id') userId: string) {
    return this.svc.connect(userId, body);
  }

  @Patch('refresh')
  refresh(@CurrentUser('id') userId: string) {
    return this.svc.refreshTokenAll(userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.svc.remove(userId, id);
  }
}