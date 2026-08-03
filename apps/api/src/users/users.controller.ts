import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.users.profile(userId);
  }

  @Patch('me')
  update(@Body() body: any, @CurrentUser('id') userId: string) {
    return this.users.updateProfile(userId, body);
  }

  @Patch('me/password')
  changePassword(
    @Body() body: { current: string; next: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.users.changePassword(userId, body.current, body.next);
  }
}