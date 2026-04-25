import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmClient } from './llm.client';
import { LlmService } from './llm.service';

@Module({
  imports: [ConfigModule],
  providers: [LlmClient, LlmService],
  exports: [LlmClient, LlmService],
})
export class LlmModule {}
