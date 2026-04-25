/**
 * 应用配置工厂
 */
export default () => ({
  app: {
    port: parseInt(process.env.PORT || '8080', 10),
    env: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV === 'development',
    isProd: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  upload: {
    mode: process.env.UPLOAD_MODE || 'local',
    maxFileSize: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    local: {
      dir: process.env.UPLOAD_DIR || process.env.LOCAL_UPLOAD_DIR || './uploads',
    },
    minio: {
      endpoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      bucket: process.env.MINIO_BUCKET || 'orange',
      useSSL: process.env.MINIO_USE_SSL === 'true',
    },
  },

  sms: {
    codeLength: 6,
    expireSeconds: 300,
    dailyLimit: 10,
    intervalSeconds: 60,
  },

  diseaseInference: {
    baseUrl: process.env.DISEASE_AI_BASE_URL || process.env.AI_SERVICE_URL,
    predictPath: process.env.DISEASE_AI_PREDICT_PATH || '/ai/disease/predict',
    timeoutMs: parseInt(process.env.DISEASE_AI_TIMEOUT_MS || '15000', 10),
    apiKey: process.env.DISEASE_AI_API_KEY || undefined,
  },

  aiService: {
    url: process.env.AI_SERVICE_URL || undefined,
    modelPath: process.env.MODEL_PATH || undefined,
    enableMock: process.env.ENABLE_AI_MOCK === 'true',
    timeoutMs: parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '15000', 10),
    fruitPerceptionPath: process.env.FRUIT_PERCEPTION_PATH || '/ai/fruit/perception',
  },

  weather: {
    provider: process.env.WEATHER_PROVIDER || 'real',
    apiKey: process.env.WEATHER_API_KEY || undefined,
    defaultLocationId: process.env.WEATHER_DEFAULT_LOCATION_ID || '30.5928,114.3055',
  },

  trace: {
    proofProvider: (process.env.TRACE_PROOF_PROVIDER || 'hash').toLowerCase(),
    anchorEnabled: process.env.TRACE_ANCHOR_ENABLED === 'true',
    anchorProvider: (
      process.env.TRACE_ANCHOR_PROVIDER ||
      process.env.TRACE_PROOF_PROVIDER ||
      'hash'
    ).toLowerCase(),
    anchorTimeoutMs: parseInt(process.env.TRACE_ANCHOR_TIMEOUT_MS || '10000', 10),
    chainProvider: (
      process.env.TRACE_CHAIN_PROVIDER ||
      process.env.TRACE_ANCHOR_PROVIDER ||
      'hash'
    ).toLowerCase(),
    chainNetwork: process.env.TRACE_CHAIN_NETWORK || process.env.EVM_CHAIN_NAME || 'sepolia',
    notaryBaseUrl: process.env.TRACE_NOTARY_BASE_URL || undefined,
    notaryAnchorPath: process.env.TRACE_NOTARY_ANCHOR_PATH || '/v1/anchors',
    notaryStatusPath: process.env.TRACE_NOTARY_STATUS_PATH || '/v1/anchors/{id}',
    notaryApiKey: process.env.TRACE_NOTARY_API_KEY || undefined,
    evm: {
      rpcUrl: process.env.EVM_RPC_URL || undefined,
      privateKey: process.env.EVM_PRIVATE_KEY || undefined,
      chainId: process.env.EVM_CHAIN_ID
        ? parseInt(process.env.EVM_CHAIN_ID, 10)
        : undefined,
      chainName: process.env.EVM_CHAIN_NAME || 'sepolia',
      contractAddress: process.env.EVM_CONTRACT_ADDRESS || undefined,
    },
  },

  wechatMp: {
    enabled: process.env.WECHAT_MP_CODE_ENABLED === 'true',
    appId: process.env.WECHAT_MP_APP_ID || '',
    appSecret: process.env.WECHAT_MP_APP_SECRET || '',
    codePage: process.env.WECHAT_MP_CODE_PAGE || 'pages/trace-view/index',
    envVersion: process.env.WECHAT_MP_ENV_VERSION || 'release',
    codeWidth: parseInt(process.env.WECHAT_MP_CODE_WIDTH || '430', 10),
    codeAutoColor: process.env.WECHAT_MP_CODE_AUTO_COLOR !== 'false',
    timeoutMs: parseInt(process.env.WECHAT_MP_TIMEOUT_MS || '10000', 10),
  },

  llm: {
    enabled: process.env.LLM_ENABLED === 'true',
    baseUrl:
      process.env.OPENAI_BASE_URL ||
      process.env.DEEPSEEK_BASE_URL ||
      process.env.LLM_BASE_URL ||
      undefined,
    chatPath: process.env.LLM_CHAT_PATH || '/v1/chat/completions',
    apiKey:
      process.env.OPENAI_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.LLM_API_KEY ||
      undefined,
    model: process.env.OPENAI_MODEL || process.env.DEEPSEEK_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini',
    timeoutMs: parseInt(
      process.env.OPENAI_TIMEOUT_MS ||
        process.env.DEEPSEEK_TIMEOUT_MS ||
        process.env.LLM_TIMEOUT_MS ||
        '15000',
      10,
    ),
    maxRetries: parseInt(
      process.env.OPENAI_MAX_RETRIES ||
        process.env.DEEPSEEK_MAX_RETRIES ||
        process.env.LLM_MAX_RETRIES ||
        '2',
      10,
    ),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.2'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '512', 10),
    observeEnabled: process.env.LLM_OBSERVE_ENABLED === 'true',
  },
});

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
  aiService: {
    url?: string;
    modelPath?: string;
    enableMock: boolean;
    timeoutMs: number;
    fruitPerceptionPath: string;
  };
  weather: {
    provider: string;
    apiKey?: string;
    defaultLocationId: string;
  };
  trace: {
    proofProvider: string;
    anchorEnabled: boolean;
    anchorProvider: string;
    anchorTimeoutMs: number;
    chainProvider: string;
    chainNetwork: string;
    notaryBaseUrl?: string;
    notaryAnchorPath: string;
    notaryStatusPath: string;
    notaryApiKey?: string;
    evm: {
      rpcUrl?: string;
      privateKey?: string;
      chainId?: number;
      chainName: string;
      contractAddress?: string;
    };
  };
  wechatMp: {
    enabled: boolean;
    appId: string;
    appSecret: string;
    codePage: string;
    envVersion: string;
    codeWidth: number;
    codeAutoColor: boolean;
    timeoutMs: number;
  };
  llm: {
    enabled: boolean;
    baseUrl?: string;
    chatPath: string;
    apiKey?: string;
    model: string;
    timeoutMs: number;
    maxRetries: number;
    temperature: number;
    maxTokens: number;
    observeEnabled: boolean;
  };
}
