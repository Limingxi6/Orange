import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { LocalUploadStorage } from './storage/local-upload.storage';
import { MinioUploadStorage } from './storage/minio-upload.storage';

@Module({
  controllers: [UploadController],
  providers: [UploadService, LocalUploadStorage, MinioUploadStorage],
  exports: [UploadService],
})
export class UploadModule {}

