import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { UpdateProfileDto, ChangePasswordDto } from './dto/users.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.users.profile(userId);
  }

  @Patch('me')
  update(@Body() dto: UpdateProfileDto, @CurrentUser('id') userId: string) {
    return this.users.updateProfile(userId, dto);
  }

  @Patch('me/password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.users.changePassword(userId, dto.current, dto.next);
  }
}