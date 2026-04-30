import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { extname, isAbsolute, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { StoredFileResult, UploadStorage } from './upload-storage.interface';

@Injectable()
export class LocalUploadStorage implements UploadStorage {
  constructor(private readonly configService: ConfigService) {}

  async saveImage(file: Express.Multer.File): Promise<StoredFileResult> {
    const uploadDir = this.getUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });

    const extension = this.getSafeExtension(file);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const fullPath = join(uploadDir, filename);

    await fs.writeFile(fullPath, file.buffer);

    return {
      filename,
      size: file.size,
      path: fullPath,
    };
  }

  private getUploadDir() {
    const dir = this.configService.get<string>('upload.local.dir', './uploads');
    return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  }

  private getSafeExtension(file: Express.Multer.File) {
    const originExt = extname(file.originalname || '').toLowerCase();
    if (originExt === '.jpg' || originExt === '.jpeg' || originExt === '.png' || originExt === '.webp') {
      return originExt;
    }

    // 原始扩展名不可用时，按 mimetype 推断
    if (file.mimetype === 'image/jpeg') return '.jpg';
    if (file.mimetype === 'image/png') return '.png';
    if (file.mimetype === 'image/webp') return '.webp';

    return '.jpg';
  }
}

