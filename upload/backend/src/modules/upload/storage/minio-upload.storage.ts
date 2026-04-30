import { Injectable } from '@nestjs/common';
import { UploadStorage, StoredFileResult } from './upload-storage.interface';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCode } from '../../../common/constants/error-code.enum';

/**
 * MinIO 存储占位实现（后续扩展）
 * 后续接入 minio SDK 时，保持 saveImage 方法签名不变即可平滑替换。
 */
@Injectable()
export class MinioUploadStorage implements UploadStorage {
  async saveImage(_file: Express.Multer.File): Promise<StoredFileResult> {
    throw new BusinessException(
      ErrorCode.OPERATION_FAILED,
      'MinIO 存储尚未启用，请切换到本地存储模式',
    );
  }
}

