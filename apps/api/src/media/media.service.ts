import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagService } from '../features/feature-flag.service';
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getAppBaseUrl } from '../common/app-url';

const execFileAsync = promisify(execFile);

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  readonly uploadRoot: string;

  constructor(private readonly config: ConfigService) {
    this.uploadRoot = this.config.get<string>('UPLOAD_DIR', 'uploads');
    mkdirSync(this.uploadRoot, { recursive: true });
  }

  getUrl(filename: string): string {
    const base = getAppBaseUrl(this.config);
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
    private readonly flags: FeatureFlagService,
  ) {}

  async uploadMany(userId: string, files: Express.Multer.File[]) {
    await this.flags.assertEnabled('media_upload');
    if (!files || files.length === 0) throw new BadRequestException('Wajib unggah minimal 1 file');
    const results: any[] = [];
    for (const f of files) {
      results.push(await this.upload(userId, f));
    }
    return results;
  }

  async upload(userId: string, file: Express.Multer.File, folder = 'media') {
    await this.flags.assertEnabled('media_upload');
    if (!file) throw new BadRequestException('File wajib diunggah');
    const info = await this.storage.save(file.buffer, file.mimetype, folder);
    const absPath = join(this.storage.uploadRoot, info.filename);
    let duration: number | null = null;
    let thumbnail: string | null = null;
    if (info.fileType === 'video') {
      duration = await this.probeDuration(absPath);
      thumbnail = await this.extractThumbnail(absPath);
    }
    return this.prisma.mediaFile.create({
      data: {
        userId,
        filename: info.filename,
        originalName: file.originalname,
        fileType: info.fileType,
        mimeType: info.mimeType,
        fileSize: info.fileSize,
        folder,
        duration,
        thumbnail,
      },
    });
  }

  async regenerateThumbnail(userId: string, id: string) {
    const media = await this.prisma.mediaFile.findFirst({ where: { id, userId } });
    if (!media) throw new BadRequestException('Media tidak ditemukan');
    if (media.fileType !== 'video') throw new BadRequestException('Thumbnail hanya tersedia untuk video');
    const absPath = join(this.storage.uploadRoot, media.filename);
    const thumbnail = await this.extractThumbnail(absPath);
    if (!thumbnail) throw new BadRequestException('Gagal membuat thumbnail dari video');
    const duration = media.duration ?? (await this.probeDuration(absPath));
    return this.prisma.mediaFile.update({
      where: { id },
      data: { thumbnail, duration },
    });
  }

  /**
   * Accept a thumbnail image generated in the browser (canvas) so video
   * thumbnails work even when ffmpeg is unavailable on the server.
   */
  async uploadThumbnail(userId: string, id: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File thumbnail wajib diunggah');
    const media = await this.prisma.mediaFile.findFirst({ where: { id, userId } });
    if (!media) throw new BadRequestException('Media tidak ditemukan');
    if (media.fileType !== 'video') throw new BadRequestException('Thumbnail hanya tersedia untuk video');

    const thumbFile = `${randomUUID()}.jpg`;
    const thumbAbs = join(this.storage.uploadRoot, 'media', thumbFile);
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(thumbAbs);
      ws.on('error', reject);
      ws.on('finish', () => resolve());
      ws.end(file.buffer);
    });

    const duration = media.duration ?? (await this.probeDuration(join(this.storage.uploadRoot, media.filename)));
    return this.prisma.mediaFile.update({
      where: { id },
      data: { thumbnail: `media/${thumbFile}`, duration },
    });
  }

  private async probeDuration(absPath: string): Promise<number | null> {
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', absPath],
        { timeout: 20000 },
      );
      const dur = parseFloat(String(stdout).trim());
      return Number.isFinite(dur) ? dur : null;
    } catch {
      return null;
    }
  }

  private async extractThumbnail(videoAbsPath: string): Promise<string | null> {
    const thumbFile = `${randomUUID()}.jpg`;
    const thumbAbs = join(this.storage.uploadRoot, 'media', thumbFile);
    const attempts: Array<Array<string>> = [
      ['-ss', '1'],
      ['-ss', '0.5'],
      ['-ss', '0'],
    ];
    for (const ss of attempts) {
      try {
        await execFileAsync(
          'ffmpeg',
          ['-y', ...ss, '-i', videoAbsPath, '-frames:v', '1', '-vf', 'scale=640:-2', thumbAbs],
          { timeout: 30000 },
        );
        if (existsSync(thumbAbs)) return `media/${thumbFile}`;
      } catch {
        /* try next seek time */
      }
    }
    try {
      if (existsSync(thumbAbs)) unlinkSync(thumbAbs);
    } catch {
      /* noop */
    }
    return null;
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