import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { RiskEngineService } from './risk-engine.service';

@Module({
  imports: [AiModule],
  controllers: [RiskController],
  providers: [RiskService, RiskEngineService],
  exports: [RiskService],
})
export class RiskModule {}

