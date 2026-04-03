import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { RiskEngineService } from './risk-engine.service';

@Module({
  controllers: [RiskController],
  providers: [RiskService, RiskEngineService],
  exports: [RiskService],
})
export class RiskModule {}

