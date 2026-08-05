import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/pdf',
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024;

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          return cb(new BadRequestException(`Tipe file ${file.mimetype} tidak diizinkan`), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('id') userId: string,
  ) {
    return this.media.uploadMany(userId, files || []);
  }

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.media.list(userId);
  }

  @Post(':id/thumbnail')
  thumbnail(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.media.regenerateThumbnail(userId, id);
  }

  @Post(':id/thumbnail-upload')
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Thumbnail harus berupa gambar'), false);
        }
        cb(null, true);
      },
    }),
  )
  thumbnailUpload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.media.uploadThumbnail(userId, id, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.media.remove(userId, id);
  }
}