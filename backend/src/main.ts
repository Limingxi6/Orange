import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { isAbsolute, resolve } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 创建应用实例
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 获取配置服务
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 8080);
  const env = configService.get<string>('app.env', 'development');
  const isDev = configService.get<boolean>('app.isDev', true);

  // 设置全局前缀
  app.setGlobalPrefix('api', {
    exclude: ['/ai/disease/predict', '/ai/fruit/grade', '/chain/verify/:batchId'],
  });

  // 启用 CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 本地静态资源映射（图片上传）
  const localUploadDir = configService.get<string>('upload.local.dir', './uploads');
  const staticDir = isAbsolute(localUploadDir)
    ? localUploadDir
    : resolve(process.cwd(), localUploadDir);
  app.useStaticAssets(staticDir, {
    prefix: '/uploads/',
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剥离未在 DTO 中定义的属性
      forbidNonWhitelisted: true, // 存在未定义属性时抛出错误
      transform: true, // 自动类型转换
      transformOptions: {
        enableImplicitConversion: true, // 启用隐式类型转换
      },
    }),
  );

  // Swagger 配置（仅开发环境启用）
  if (isDev) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('橘源通 API')
      .setDescription('橘源通微信小程序后端接口文档')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: '输入 JWT Token',
          in: 'header',
        },
        'JWT',
      )
      .addTag('auth', '认证模块')
      .addTag('batch', '批次管理')
      .addTag('log', '农事日志')
      .addTag('disease', '病害识别')
      .addTag('risk', '风险预警')
      .addTag('price', '定价服务')
      .addTag('product', '产品管理')
      .addTag('trace', '溯源查询')
      .addTag('weather', '天气服务')
      .addTag('upload', '文件上传')
      .addTag('user', '用户与权限')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.log(`Swagger docs available at http://localhost:${port}/docs`);
  }

  // 启动服务
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`Environment: ${env}`);
}

bootstrap();
