import { Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get('plans')
  plans() {
    return this.subs.getPlans();
  }

  @Get('active')
  active(@CurrentUser('id') userId: string) {
    return this.subs.getActive(userId);
  }

  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.subs.getMySubscriptions(userId);
  }

  @Get('usage')
  usage(@CurrentUser('id') userId: string) {
    return this.subs.usage(userId);
  }

  @Post('subscribe')
  subscribe(
    @Body() body: { planId: string; method: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.subs.subscribe(userId, body.planId, body.method);
  }

  @Post(':id/proof')
  @UseInterceptors(FileInterceptor('file'))
  async proof(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) throw new BadRequestException('File bukti wajib diunggah');
    const url = await this.subs.saveProof(file);
    return this.subs.uploadProof(userId, id, url);
  }
}