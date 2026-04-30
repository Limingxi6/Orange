import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis 模块
 * 全局模块，无需在其他模块中导入即可使用 RedisService
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
