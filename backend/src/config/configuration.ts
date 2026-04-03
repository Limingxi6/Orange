/**
 * 应用配置工厂函数
 * 将环境变量映射为结构化的配置对象
 */
export default () => ({
  // 应用配置
  app: {
    port: parseInt(process.env.PORT || '8080', 10),
    env: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV === 'development',
    isProd: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
  },

  // 数据库配置
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis 配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 文件上传配置
  upload: {
    mode: process.env.UPLOAD_MODE || 'local', // local | minio | cos
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ],

    // 本地存储配置
    local: {
      dir: process.env.LOCAL_UPLOAD_DIR || './uploads',
    },

    // MinIO 配置
    minio: {
      endpoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      bucket: process.env.MINIO_BUCKET || 'orange',
      useSSL: process.env.MINIO_USE_SSL === 'true',
    },
  },

  // 短信验证码配置
  sms: {
    codeLength: 6,
    expireSeconds: 300, // 5 分钟
    dailyLimit: 10, // 每日发送上限
    intervalSeconds: 60, // 发送间隔
  },

  // 病害 AI 推理服务配置
  diseaseInference: {
    baseUrl: process.env.DISEASE_AI_BASE_URL,
    predictPath: process.env.DISEASE_AI_PREDICT_PATH || '/predict',
    timeoutMs: parseInt(process.env.DISEASE_AI_TIMEOUT_MS || '15000', 10),
    apiKey: process.env.DISEASE_AI_API_KEY || undefined,
  },
});

/**
 * 配置类型定义
 */
export interface AppConfig {
  app: {
    port: number;
    env: string;
    isDev: boolean;
    isProd: boolean;
    isTest: boolean;
  };
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  upload: {
    mode: 'local' | 'minio' | 'cos';
    maxFileSize: number;
    allowedMimeTypes: string[];
    local: {
      dir: string;
    };
    minio: {
      endpoint?: string;
      port: number;
      accessKey?: string;
      secretKey?: string;
      bucket: string;
      useSSL: boolean;
    };
  };
  sms: {
    codeLength: number;
    expireSeconds: number;
    dailyLimit: number;
    intervalSeconds: number;
  };
  diseaseInference: {
    baseUrl?: string;
    predictPath: string;
    timeoutMs: number;
    apiKey?: string;
  };
}
