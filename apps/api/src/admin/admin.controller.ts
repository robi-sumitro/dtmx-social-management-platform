import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import {
  CreateUserDto,
  PlanDto,
  UpdatePlanDto,
  SetFeatureDto,
  SetPaymentMethodsDto,
  PaymentSettingDto,
  AiSettingDto,
} from './dto/admin.dto';

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
  createUser(@Body() dto: CreateUserDto) {
    return this.admin.createUser(dto);
  }

  @Patch('users/:id/toggle')
  toggleUser(@Param('id') id: string) {
    return this.admin.toggleUser(id);
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string) {
    return this.admin.deleteUser(id);
  }

  @Get('plans')
  allPlans() {
    return this.admin.listPlans();
  }

  @Post('plans')
  createPlan(@Body() dto: PlanDto) {
    return this.admin.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.admin.updatePlan(id, dto);
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
  setFeature(@Param('key') key: string, @Body() dto: SetFeatureDto) {
    return this.admin.setFlag(key, dto.enabled);
  }

  @Get('payments/methods')
  paymentMethods() {
    return this.admin.getPaymentMethods();
  }

  @Post('payments/methods')
  setPaymentMethods(@Body() dto: SetPaymentMethodsDto) {
    return this.admin.setPaymentMethods(dto.methods);
  }

  @Get('payments/settings')
  paymentSettings() {
    return this.admin.listPaymentSettings();
  }

  @Post('payments/settings/:key')
  savePaymentSetting(@Param('key') key: string, @Body() dto: PaymentSettingDto) {
    return this.admin.savePaymentSetting(key, dto);
  }

  @Delete('payments/settings/:key')
  removePaymentSetting(@Param('key') key: string) {
    return this.admin.removePaymentSetting(key);
  }

  @Get('ai/settings')
  aiSettings() {
    return this.admin.listAiSettings();
  }

  @Post('ai/settings/:key')
  saveAiSetting(@Param('key') key: string, @Body() dto: AiSettingDto) {
    return this.admin.saveAiSetting(key, dto.value);
  }

  @Get('ai/models/:provider')
  listAiModels(@Param('provider') provider: string, @Query('key') apiKey: string) {
    return this.admin.listAiModels(provider, apiKey ?? '');
  }
}