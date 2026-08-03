import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, fullName: true, avatar: true, role: true, createdAt: true, quotaAi: true,
      },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    return user;
  }

  async updateProfile(userId: string, data: { fullName?: string; username?: string; avatar?: string }) {
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new BadRequestException('Password tidak valid');
    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) throw new BadRequestException('Password lama salah');
    const hash = await bcrypt.hash(next, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    return { ok: true };
  }
}