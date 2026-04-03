import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { LocalUploadStorage } from './storage/local-upload.storage';
import { MinioUploadStorage } from './storage/minio-upload.storage';
import { UploadStorage } from './storage/upload-storage.interface';

@Injectable()
export class UploadService {
  constructor(
    private readonly configService: ConfigService,
    private readonly localUploadStorage: LocalUploadStorage,
    private readonly minioUploadStorage: MinioUploadStorage,
  ) {}

  async uploadImage(file: Express.Multer.File, req: Request) {
    this.validateFile(file);

    const storage = this.resolveStorage();
    const stored = await storage.saveImage(file);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/${stored.filename}`;

    return {
      url,
      filename: stored.filename,
      size: stored.size,
    };
  }

  private resolveStorage(): UploadStorage {
    const mode = this.configService.get<string>('upload.mode', 'local');
    if (mode === 'minio') {
      return this.minioUploadStorage;
    }
    // MVP 默认本地存储；cos 等模式后续可在这里扩展
    return this.localUploadStorage;
  }

  private validateFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, '请上传图片文件');
    }

    const maxFileSize = this.configService.get<number>('upload.maxFileSize', 10 * 1024 * 1024);
    if (file.size > maxFileSize) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, `文件大小不能超过 ${Math.floor(maxFileSize / 1024 / 1024)}MB`);
    }

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, '仅支持 jpg/jpeg/png/webp 图片格式');
    }
  }
}

