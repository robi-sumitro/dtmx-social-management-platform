import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationInput {
  userId: string;
  type?: string;
  title: string;
  message?: string;
  link?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type || 'info',
        title: input.title,
        message: input.message,
        link: input.link,
        data: (input.data as any) || undefined,
      },
    });
  }

  /** Create a notification for every admin user. */
  async createForAdmins(input: Omit<CreateNotificationInput, 'userId'>) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true },
    });
    if (admins.length === 0) return [];
    return this.prisma.$transaction(
      admins.map((a) =>
        this.prisma.notification.create({
          data: {
            userId: a.id,
            type: input.type || 'info',
            title: input.title,
            message: input.message,
            link: input.link,
            data: (input.data as any) || undefined,
          },
        }),
      ),
    );
  }

  async listForUser(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async remove(userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');
    await this.prisma.notification.delete({ where: { id } });
    return { ok: true };
  }
}
