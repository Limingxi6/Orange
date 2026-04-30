import { ConfigService } from '@nestjs/config';
import { LlmRuntimeConfig } from './llm.types';

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 512;

function firstNonEmptyEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function toInt(value: string | number | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function toFloat(value: string | number | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export function resolveLlmConfig(configService: ConfigService): LlmRuntimeConfig {
  const envApiKey = firstNonEmptyEnv(['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'LLM_API_KEY']);
  const envBaseUrl = firstNonEmptyEnv(['OPENAI_BASE_URL', 'DEEPSEEK_BASE_URL', 'LLM_BASE_URL']);
  const envModel = firstNonEmptyEnv(['LLM_MODEL']);
  const envTimeoutMs = firstNonEmptyEnv([
    'OPENAI_TIMEOUT_MS',
    'DEEPSEEK_TIMEOUT_MS',
    'LLM_TIMEOUT_MS',
  ]);
  const envMaxRetries = firstNonEmptyEnv([
    'OPENAI_MAX_RETRIES',
    'DEEPSEEK_MAX_RETRIES',
    'LLM_MAX_RETRIES',
  ]);

  const apiKey = envApiKey || configService.get<string>('llm.apiKey', '');
  const baseUrl = envBaseUrl || configService.get<string>('llm.baseUrl', '');
  const model = envModel || configService.get<string>('llm.model', 'deepseek-chat');
  const chatPath = configService.get<string>('llm.chatPath', '/v1/chat/completions');

  const enabledFlag = configService.get<boolean>('llm.enabled', false);
  const enabled = Boolean(enabledFlag || (apiKey && baseUrl && model));

  return {
    enabled,
    apiKey,
    baseUrl,
    model,
    chatPath,
    timeoutMs: toInt(envTimeoutMs ?? configService.get<number>('llm.timeoutMs'), DEFAULT_TIMEOUT_MS),
    maxRetries: toInt(
      envMaxRetries ?? configService.get<number>('llm.maxRetries'),
      DEFAULT_MAX_RETRIES,
    ),
    defaultTemperature: toFloat(
      configService.get<number>('llm.temperature'),
      DEFAULT_TEMPERATURE,
    ),
    defaultMaxTokens: toInt(configService.get<number>('llm.maxTokens'), DEFAULT_MAX_TOKENS),
  };
}
