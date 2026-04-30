import { Module } from '@nestjs/common';
import { LlmModule } from '../../llm/llm.module';
import { AiNarrativeService } from './ai-narrative.service';

@Module({
  imports: [LlmModule],
  providers: [AiNarrativeService],
  exports: [AiNarrativeService],
})
export class AiModule {}
