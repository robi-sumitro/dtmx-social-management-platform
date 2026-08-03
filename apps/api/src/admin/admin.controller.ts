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
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  @Post('users')
  createUser(@Body() body: any) {
    return this.admin.createUser(body);
  }

  @Patch('users/:id/toggle')
  toggleUser(@Param('id') id: string) {
    return this.admin.toggleUser(id);
  }

  @Get('plans')
  allPlans() {
    return this.admin.listPlans();
  }

  @Post('plans')
  createPlan(@Body() body: any) {
    return this.admin.createPlan(body);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() body: any) {
    return this.admin.updatePlan(id, body);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.admin.deletePlan(id);
  }

  @Get('subscriptions/pending')
  pendingSubs() {
    return this.admin.listPendingSubscriptions();
  }

  @Post('subscriptions/:id/confirm')
  confirm(@Param('id') id: string) {
    return this.admin.confirmSubscription(id);
  }

  @Get('features')
  features() {
    return this.admin.listFlags();
  }

  @Patch('features/:key')
  setFeature(@Param('key') key: string, @Body() body: { enabled: boolean }) {
    return this.admin.setFlag(key, body.enabled);
  }

  @Get('payments/methods')
  paymentMethods() {
    return this.admin.getPaymentMethods();
  }

  @Post('payments/methods')
  setPaymentMethods(@Body() body: { methods: string[] }) {
    return this.admin.setPaymentMethods(body.methods);
  }
}