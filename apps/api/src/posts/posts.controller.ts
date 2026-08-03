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
  ForbiddenException,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser('id') userId: string, @Query('status') status?: string) {
    return this.posts.list(userId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    return this.posts.create(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  one(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.posts.getById(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    return this.posts.update(userId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.posts.cancel(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.posts.delete(userId, id);
  }

  // admin export
  @UseGuards(JwtAuthGuard)
  @Post('scope/admin/all')
  allAdmin(@CurrentUser('role') role: string) {
    if (role !== 'admin') throw new ForbiddenException('Admin only');
    return this.posts.listAll();
  }
}