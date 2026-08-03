import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  readonly uploadRoot: string;

  constructor(private readonly config: ConfigService) {
    this.uploadRoot = this.config.get<string>('UPLOAD_DIR', 'uploads');
    mkdirSync(this.uploadRoot, { recursive: true });
  }

  getUrl(filename: string): string {
    const base = this.config.get<string>('APP_URL', 'http://localhost:3000');
    return `${base}/uploads/${encodeURIComponent(filename)}`;
  }

  async save(buffer: Buffer, mimetype: string, folder = 'general'): Promise<{
    filename: string;
    url: string;
    fileType: 'image' | 'video' | 'text';
    fileSize: number;
    mimeType: string;
  }> {
    const ext = this.extOf(mimetype);
    const filename = `${randomUUID()}${ext}`;
    const dir = join(this.uploadRoot, folder);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, filename);
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(path);
      ws.on('error', reject);
      ws.on('finish', () => resolve());
      ws.end(buffer);
    });
    const type = mimetype.startsWith('image/')
      ? 'image'
      : mimetype.startsWith('video/')
      ? 'video'
      : 'text';
    return {
      filename: `${folder}/${filename}`,
      url: this.getUrl(`${folder}/${filename}`),
      fileType: type,
      fileSize: buffer.byteLength,
      mimeType: mimetype,
    };
  }

  private extOf(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/pdf': '.pdf',
    };
    return map[mime] || '.bin';
  }
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
  ) {}

  async uploadMany(userId: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) throw new BadRequestException('Wajib unggah minimal 1 file');
    const results: any[] = [];
    for (const f of files) {
      results.push(await this.upload(userId, f));
    }
    return results;
  }

  async upload(userId: string, file: Express.Multer.File, folder = 'media') {
    if (!file) throw new BadRequestException('File wajib diunggah');
    const info = await this.storage.save(file.buffer, file.mimetype, folder);
    return this.prisma.mediaFile.create({
      data: {
        userId,
        filename: info.filename,
        originalName: file.originalname,
        fileType: info.fileType,
        mimeType: info.mimeType,
        fileSize: info.fileSize,
        folder,
      },
    });
  }

  async list(userId: string) {
    return this.prisma.mediaFile.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async remove(userId: string, id: string) {
    const ref = await this.prisma.postMedia.findFirst({ where: { mediaId: id } });
    const media = await this.prisma.mediaFile.findFirst({ where: { id, userId } });
    if (ref) throw new BadRequestException('Media sedang dipakai di postingan');
    if (!media) throw new BadRequestException('Media tidak ditemukan');
    await this.prisma.mediaFile.delete({ where: { id } });
    return { ok: true };
  }
}