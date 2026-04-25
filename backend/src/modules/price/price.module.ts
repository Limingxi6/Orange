import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { UploadModule } from '../upload/upload.module';
import { AiFruitController } from './ai-fruit.controller';
import { FruitInferenceClient } from './fruit-inference.client';
import { PriceController } from './price.controller';
import { PriceService } from './price.service';

@Module({
  imports: [UploadModule, AiModule],
  controllers: [PriceController, AiFruitController],
  providers: [PriceService, FruitInferenceClient],
  exports: [PriceService],
})
export class PriceModule {}

