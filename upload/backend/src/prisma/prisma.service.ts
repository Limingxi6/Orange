import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 服务
 * 管理数据库连接生命周期
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * 清理数据库（仅用于测试）
   */
  async cleanDatabase() {
    if (process.env.APP_ENV !== 'test') {
      throw new Error('cleanDatabase is only allowed in test environment');
    }

    // 按照外键依赖顺序删除（先删子表，后删父表）
    await this.traceRecord.deleteMany();
    await this.product.deleteMany();
    await this.riskRecord.deleteMany();
    await this.diseaseRecord.deleteMany();
    await this.farmingLog.deleteMany();
    await this.weatherCache.deleteMany();
    await this.batch.deleteMany();
    await this.user.deleteMany();
  }
}
