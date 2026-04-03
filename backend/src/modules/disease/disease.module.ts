import { Module } from '@nestjs/common';
import { DiseaseController } from './disease.controller';
import { DiseaseService } from './disease.service';
import { UploadModule } from '../upload/upload.module';
import { DiseaseInferenceClient } from './disease-inference.client';

@Module({
  imports: [UploadModule],
  controllers: [DiseaseController],
  providers: [DiseaseService, DiseaseInferenceClient],
  exports: [DiseaseService],
})
export class DiseaseModule {}

