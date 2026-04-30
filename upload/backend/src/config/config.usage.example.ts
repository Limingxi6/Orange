/**
 * ============================================
 * 配置读取示例（仅供参考，不参与编译）
 * ============================================
 *
 * 本文件展示如何在各模块中读取配置
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExampleService {
  constructor(private configService: ConfigService) {}

  /**
   * 示例 1：读取应用配置
   */
  getAppConfig() {
    // 读取单个配置项
    const port = this.configService.get<number>('app.port');
    const env = this.configService.get<string>('app.env');
    const isDev = this.configService.get<boolean>('app.isDev');

    // 读取整个配置块
    const appConfig = this.configService.get('app');
    // appConfig = { port: 8080, env: 'development', isDev: true, isProd: false, isTest: false }

    return { port, env, isDev, appConfig };
  }

  /**
   * 示例 2：读取数据库配置
   */
  getDatabaseConfig() {
    const databaseUrl = this.configService.get<string>('database.url');
    return { databaseUrl };
  }

  /**
   * 示例 3：读取 Redis 配置
   */
  getRedisConfig() {
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port');
    const password = this.configService.get<string>('redis.password');

    // 或者读取整个块
    const redisConfig = this.configService.get('redis');
    // redisConfig = { host: 'localhost', port: 6379, password: undefined }

    return { host, port, password, redisConfig };
  }

  /**
   * 示例 4：读取 JWT 配置
   */
  getJwtConfig() {
    const secret = this.configService.get<string>('jwt.secret');
    const expiresIn = this.configService.get<string>('jwt.expiresIn');

    return { secret, expiresIn };
  }

  /**
   * 示例 5：读取上传配置
   */
  getUploadConfig() {
    const mode = this.configService.get<string>('upload.mode'); // 'local' | 'minio' | 'cos'
    const maxFileSize = this.configService.get<number>('upload.maxFileSize');
    const allowedMimeTypes = this.configService.get<string[]>('upload.allowedMimeTypes');

    // 本地存储配置
    const localDir = this.configService.get<string>('upload.local.dir');

    // MinIO 配置
    const minioEndpoint = this.configService.get<string>('upload.minio.endpoint');
    const minioPort = this.configService.get<number>('upload.minio.port');
    const minioAccessKey = this.configService.get<string>('upload.minio.accessKey');
    const minioSecretKey = this.configService.get<string>('upload.minio.secretKey');
    const minioBucket = this.configService.get<string>('upload.minio.bucket');

    return {
      mode,
      maxFileSize,
      allowedMimeTypes,
      local: { dir: localDir },
      minio: {
        endpoint: minioEndpoint,
        port: minioPort,
        accessKey: minioAccessKey,
        secretKey: minioSecretKey,
        bucket: minioBucket,
      },
    };
  }

  /**
   * 示例 6：读取短信配置
   */
  getSmsConfig() {
    const codeLength = this.configService.get<number>('sms.codeLength');
    const expireSeconds = this.configService.get<number>('sms.expireSeconds');
    const dailyLimit = this.configService.get<number>('sms.dailyLimit');
    const intervalSeconds = this.configService.get<number>('sms.intervalSeconds');

    return { codeLength, expireSeconds, dailyLimit, intervalSeconds };
  }

  /**
   * 示例 7：带默认值的读取
   */
  getWithDefault() {
    // 如果配置不存在，使用默认值
    const timeout = this.configService.get<number>('app.timeout', 30000);
    const debug = this.configService.get<boolean>('app.debug', false);

    return { timeout, debug };
  }

  /**
   * 示例 8：在 Controller 中使用
   */
  // @Controller('example')
  // export class ExampleController {
  //   constructor(private configService: ConfigService) {}
  //
  //   @Get('config')
  //   getConfig() {
  //     return {
  //       env: this.configService.get('app.env'),
  //       uploadMode: this.configService.get('upload.mode'),
  //     };
  //   }
  // }
}

/**
 * ============================================
 * 配置路径速查表
 * ============================================
 *
 * | 配置路径                    | 类型      | 说明                |
 * |----------------------------|-----------|---------------------|
 * | app.port                   | number    | 服务端口            |
 * | app.env                    | string    | 运行环境            |
 * | app.isDev                  | boolean   | 是否开发环境        |
 * | app.isProd                 | boolean   | 是否生产环境        |
 * | app.isTest                 | boolean   | 是否测试环境        |
 * | database.url               | string    | 数据库连接字符串    |
 * | redis.host                 | string    | Redis 主机          |
 * | redis.port                 | number    | Redis 端口          |
 * | redis.password             | string?   | Redis 密码          |
 * | jwt.secret                 | string    | JWT 密钥            |
 * | jwt.expiresIn              | string    | JWT 过期时间        |
 * | upload.mode                | string    | 上传模式            |
 * | upload.maxFileSize         | number    | 最大文件大小        |
 * | upload.allowedMimeTypes    | string[]  | 允许的 MIME 类型    |
 * | upload.local.dir           | string    | 本地上传目录        |
 * | upload.minio.endpoint      | string?   | MinIO 端点          |
 * | upload.minio.port          | number    | MinIO 端口          |
 * | upload.minio.accessKey     | string?   | MinIO Access Key    |
 * | upload.minio.secretKey     | string?   | MinIO Secret Key    |
 * | upload.minio.bucket        | string    | MinIO Bucket        |
 * | upload.minio.useSSL        | boolean   | MinIO 是否使用 SSL  |
 * | sms.codeLength             | number    | 验证码长度          |
 * | sms.expireSeconds          | number    | 验证码过期时间(秒)  |
 * | sms.dailyLimit             | number    | 每日发送上限        |
 * | sms.intervalSeconds        | number    | 发送间隔(秒)        |
 */
