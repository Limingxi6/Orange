import { Module } from '@nestjs/common';
import { DiseaseController } from './disease.controller';
import { DiseaseService } from './disease.service';
import { UploadModule } from '../upload/upload.module';
import { DiseaseInferenceClient } from './disease-inference.client';
import { AiModule } from '../ai/ai.module';
import { AiDiseaseController } from './ai-disease.controller';

@Module({
  imports: [UploadModule, AiModule],
  controllers: [DiseaseController, AiDiseaseController],
  providers: [DiseaseService, DiseaseInferenceClient],
  exports: [DiseaseService],
})
export class DiseaseModule {}

