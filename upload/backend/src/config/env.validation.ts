import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(8080),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  APP_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

  DATABASE_URL: Joi.string().required().messages({
    'string.empty': 'DATABASE_URL cannot be empty',
    'any.required': 'DATABASE_URL is required',
  }),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  JWT_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_SECRET should be at least 16 chars',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  UPLOAD_MODE: Joi.string().valid('local', 'minio', 'cos').default('local'),
  UPLOAD_DIR: Joi.string().optional(),
  LOCAL_UPLOAD_DIR: Joi.string().default('./uploads'),

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

  DISEASE_AI_BASE_URL: Joi.string().uri().allow('').optional(),
  DISEASE_AI_PREDICT_PATH: Joi.string().default('/ai/disease/predict'),
  DISEASE_AI_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  DISEASE_AI_API_KEY: Joi.string().allow('').default(''),

  AI_SERVICE_URL: Joi.string().uri().allow('').optional(),
  AI_SERVICE_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  FRUIT_PERCEPTION_PATH: Joi.string().default('/ai/fruit/perception'),
  MODEL_PATH: Joi.string().allow('').default(''),
  ENABLE_AI_MOCK: Joi.boolean().default(false),
  WEATHER_PROVIDER: Joi.string().valid('mock', 'real').default('real'),
  WEATHER_API_KEY: Joi.string().allow('').default(''),
  WEATHER_DEFAULT_LOCATION_ID: Joi.string()
    .pattern(/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/)
    .allow('')
    .default('30.5928,114.3055'),
  TRACE_PROOF_PROVIDER: Joi.string()
    .valid('hash', 'chain', 'fabric', 'evm', 'notary')
    .insensitive()
    .default('hash'),
  TRACE_ANCHOR_ENABLED: Joi.boolean().default(false),
  TRACE_ANCHOR_PROVIDER: Joi.string()
    .valid('hash', 'evm', 'notary')
    .insensitive()
    .default('hash'),
  TRACE_ANCHOR_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  TRACE_CHAIN_PROVIDER: Joi.string().default('hash'),
  TRACE_CHAIN_NETWORK: Joi.string().default('sepolia'),
  TRACE_NOTARY_BASE_URL: Joi.string().uri().allow('').default(''),
  TRACE_NOTARY_ANCHOR_PATH: Joi.string().default('/v1/anchors'),
  TRACE_NOTARY_STATUS_PATH: Joi.string().default('/v1/anchors/{id}'),
  TRACE_NOTARY_API_KEY: Joi.string().allow('').default(''),
  EVM_RPC_URL: Joi.string().uri().allow('').default(''),
  EVM_PRIVATE_KEY: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .allow('')
    .default(''),
  EVM_CHAIN_ID: Joi.string().pattern(/^\d+$/).allow('').default(''),
  EVM_CHAIN_NAME: Joi.string().default('sepolia'),
  EVM_CONTRACT_ADDRESS: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .allow('')
    .default(''),
  EVM_INITIAL_OWNER: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .allow('')
    .default(''),

  WECHAT_MP_CODE_ENABLED: Joi.boolean().default(false),
  WECHAT_MP_APP_ID: Joi.string().allow('').default(''),
  WECHAT_MP_APP_SECRET: Joi.string().allow('').default(''),
  WECHAT_MP_CODE_PAGE: Joi.string().default('pages/trace-view/index'),
  WECHAT_MP_ENV_VERSION: Joi.string().valid('release', 'trial', 'develop').default('release'),
  WECHAT_MP_CODE_WIDTH: Joi.number().integer().min(280).max(1280).default(430),
  WECHAT_MP_CODE_AUTO_COLOR: Joi.boolean().default(true),
  WECHAT_MP_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),

  LLM_ENABLED: Joi.boolean().default(false),
  LLM_BASE_URL: Joi.string().uri().allow('').optional(),
  LLM_CHAT_PATH: Joi.string().default('/v1/chat/completions'),
  LLM_API_KEY: Joi.string().allow('').default(''),
  LLM_MODEL: Joi.string().default('deepseek-chat'),
  LLM_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  LLM_MAX_RETRIES: Joi.number().integer().min(0).default(2),
  LLM_TEMPERATURE: Joi.number().min(0).max(2).default(0.2),
  LLM_MAX_TOKENS: Joi.number().integer().min(64).default(512),
  LLM_OBSERVE_ENABLED: Joi.boolean().default(false),

  OPENAI_API_KEY: Joi.string().allow('').default(''),
  OPENAI_BASE_URL: Joi.string().uri().allow('').optional(),
  OPENAI_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  OPENAI_MAX_RETRIES: Joi.number().integer().min(0).default(2),

  DEEPSEEK_API_KEY: Joi.string().allow('').default(''),
  DEEPSEEK_BASE_URL: Joi.string().uri().allow('').optional(),
  DEEPSEEK_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  DEEPSEEK_MAX_RETRIES: Joi.number().integer().min(0).default(2),
})
  .custom((value, helpers) => {
    const anchorEnabled = Boolean(value.TRACE_ANCHOR_ENABLED);
    const anchorProvider = String(
      value.TRACE_ANCHOR_PROVIDER || value.TRACE_PROOF_PROVIDER || 'hash',
    ).toLowerCase();

    if (anchorEnabled && anchorProvider === 'evm') {
      const missing: string[] = [];
      if (!value.EVM_RPC_URL) {
        missing.push('EVM_RPC_URL');
      }
      if (!value.EVM_PRIVATE_KEY) {
        missing.push('EVM_PRIVATE_KEY');
      }
      if (!value.EVM_CHAIN_ID) {
        missing.push('EVM_CHAIN_ID');
      }
      if (!value.EVM_CONTRACT_ADDRESS) {
        missing.push('EVM_CONTRACT_ADDRESS');
      }

      if (missing.length > 0) {
        return helpers.error('any.custom', {
          message: `TRACE_ANCHOR_ENABLED=true and TRACE_ANCHOR_PROVIDER=evm require: ${missing.join(', ')}`,
        });
      }
    }

    const wechatMiniCodeEnabled = Boolean(value.WECHAT_MP_CODE_ENABLED);
    if (wechatMiniCodeEnabled) {
      const missingWechat: string[] = [];
      if (!value.WECHAT_MP_APP_ID) {
        missingWechat.push('WECHAT_MP_APP_ID');
      }
      if (!value.WECHAT_MP_APP_SECRET) {
        missingWechat.push('WECHAT_MP_APP_SECRET');
      }

      if (missingWechat.length > 0) {
        return helpers.error('any.custom', {
          message: `WECHAT_MP_CODE_ENABLED=true requires: ${missingWechat.join(', ')}`,
        });
      }
    }

    return value;
  }, 'trace anchor evm validation')
  .messages({
    'any.custom': '{{#message}}',
  });
