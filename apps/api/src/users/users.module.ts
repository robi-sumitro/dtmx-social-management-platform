import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SecurityModule } from '../common/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}