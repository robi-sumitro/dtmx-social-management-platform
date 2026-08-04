import { Body, Controller, Get, Param, Post, UseGuards, Headers, Res, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, Public } from '../common/decorators/auth.decorators';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Get('methods')
  async methods() {
    return this.payments.enabledMethods();
  }

  @Public()
  @Get('manual-info')
  async manualInfo() {
    return this.payments.manualInfo();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@CurrentUser('id') userId: string) {
    return this.payments.listMine(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async one(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.payments.getPayment(id, userId);
  }

  // Allow any (public webhook) — authenticity is enforced by signature verification
  @Public()
  @Post('webhook/:method')
  async webhook(
    @Param('method') method: string,
    @Body() body: any,
    @Headers() headers: any,
    @Req() req: any,
    @Res() res: any,
  ) {
    await this.payments.handleWebhook(method, body, headers, req.rawBody);
    return res.status(200).json({ ok: true });
  }
}