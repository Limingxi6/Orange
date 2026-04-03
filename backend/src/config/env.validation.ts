import * as Joi from 'joi';

/**
 * 环境变量校验 Schema
 * 使用 Joi 进行严格的环境变量类型和格式校验
 */
export const envValidationSchema = Joi.object({
  // 应用配置
  PORT: Joi.number().default(8080),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  // 数据库配置
  DATABASE_URL: Joi.string().required().messages({
    'string.empty': 'DATABASE_URL 不能为空',
    'any.required': 'DATABASE_URL 是必需的',
  }),

  // Redis 配置
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // JWT 配置
  JWT_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_SECRET 长度至少为 16 个字符',
    'any.required': 'JWT_SECRET 是必需的',
  }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // 文件上传配置
  UPLOAD_MODE: Joi.string()
    .valid('local', 'minio', 'cos')
    .default('local'),
  LOCAL_UPLOAD_DIR: Joi.string().default('./uploads'),

  // MinIO 配置（当 UPLOAD_MODE 为 minio 时必需）
  MINIO_ENDPOINT: Joi.string().when('UPLOAD_MODE', {
    is: 'minio',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().when('UPLOAD_MODE', {
    is: 'minio',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MINIO_SECRET_KEY: Joi.string().when('UPLOAD_MODE', {
    is: 'minio',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MINIO_BUCKET: Joi.string().default('orange'),
  MINIO_USE_SSL: Joi.boolean().default(false),

  // 病害 AI 推理配置
  DISEASE_AI_BASE_URL: Joi.string().uri().optional(),
  DISEASE_AI_PREDICT_PATH: Joi.string().default('/predict'),
  DISEASE_AI_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  DISEASE_AI_API_KEY: Joi.string().allow('').default(''),
});
