import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// 配置
import { configuration, envValidationSchema } from './config';

// 全局模块
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

// 全局过滤器、拦截器、守卫
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtStrategy } from './common/strategies/jwt.strategy';

// 业务模块（后续逐步添加）
import { AuthModule } from './modules/auth/auth.module';
import { BatchModule } from './modules/batch/batch.module';
import { LogModule } from './modules/log/log.module';
import { UploadModule } from './modules/upload/upload.module';
import { DiseaseModule } from './modules/disease/disease.module';
import { RiskModule } from './modules/risk/risk.module';
import { PriceModule } from './modules/price/price.module';
import { ProductModule } from './modules/product/product.module';
import { TraceModule } from './modules/trace/trace.module';
import { WeatherModule } from './modules/weather/weather.module';
import { UserModule } from './modules/user/user.module';
// import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    // 配置模块（使用 Joi 校验环境变量）
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true, // 遇到第一个错误即停止
      },
    }),

    // Passport 模块
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT 模块
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
    }),

    // 全局模块
    PrismaModule,
    RedisModule,

    // 业务模块（后续逐步取消注释）
    AuthModule,
    BatchModule,
    LogModule,
    UploadModule,
    DiseaseModule,
    RiskModule,
    PriceModule,
    ProductModule,
    TraceModule,
    WeatherModule,
    UserModule,
    // UploadModule,
  ],
  providers: [
    JwtStrategy,
    // 全局异常过滤器
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // 全局响应拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // 全局 JWT 守卫（所有接口默认需要认证，使用 @Public() 跳过）
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
