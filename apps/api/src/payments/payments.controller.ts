import { Body, Controller, Get, Param, Post, UseGuards, Headers, Res } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('methods')
  async methods() {
    return this.payments.enabledMethods();
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

  // Allow any (public webhook)
  @Post('webhook/:method')
  async webhook(
    @Param('method') method: string,
    @Body() body: any,
    @Headers() headers: any,
    @Res() res: any,
  ) {
    await this.payments.handleWebhook(method, body, headers);
    return res.status(200).json({ ok: true });
  }
}