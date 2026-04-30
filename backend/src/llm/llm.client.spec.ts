import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { LlmClient } from './llm.client';

describe('LlmClient', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function createClient(config: Record<string, unknown>) {
    const configService = {
      get: (key: string, defaultValue?: unknown) =>
        key in config ? config[key] : defaultValue,
    } as unknown as ConfigService;

    return new LlmClient(configService);
  }

  it('returns timeout error without logging api key when fetch is aborted', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
    delete process.env.OPENAI_TIMEOUT_MS;
    delete process.env.DEEPSEEK_TIMEOUT_MS;
    delete process.env.LLM_TIMEOUT_MS;
    delete process.env.OPENAI_MAX_RETRIES;
    delete process.env.DEEPSEEK_MAX_RETRIES;
    delete process.env.LLM_MAX_RETRIES;

    const client = createClient({
      'llm.enabled': true,
      'llm.apiKey': 'sk-sensitive-key',
      'llm.baseUrl': 'https://example.com/v1',
      'llm.model': 'deepseek-chat',
      'llm.timeoutMs': 1000,
      'llm.maxRetries': 0,
    });
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const abortError = new Error('This operation was aborted');
    abortError.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortError);

    const result = await client.chat([{ role: 'user', content: 'hello' }]);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('REQUEST_TIMEOUT');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logLine = String(warnSpy.mock.calls[0][0]);
    expect(logLine).toContain('"errorCode":"REQUEST_TIMEOUT"');
    expect(logLine).not.toContain('apiKey');
    expect(logLine).not.toContain('sk-sensitive-key');
  });

  it('classifies gateway timeout responses as upstream timeout', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
    delete process.env.OPENAI_TIMEOUT_MS;
    delete process.env.DEEPSEEK_TIMEOUT_MS;
    delete process.env.LLM_TIMEOUT_MS;
    delete process.env.OPENAI_MAX_RETRIES;
    delete process.env.DEEPSEEK_MAX_RETRIES;
    delete process.env.LLM_MAX_RETRIES;

    const client = createClient({
      'llm.enabled': true,
      'llm.apiKey': 'sk-sensitive-key',
      'llm.baseUrl': 'https://example.com/v1',
      'llm.model': 'deepseek-chat',
      'llm.timeoutMs': 1000,
      'llm.maxRetries': 1,
    });
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 504,
      text: jest.fn().mockResolvedValue('<html><h1>504 Gateway Time-out</h1></html>'),
    });

    const result = await client.chat([{ role: 'user', content: 'hello' }]);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('UPSTREAM_TIMEOUT');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const logLine = String(warnSpy.mock.calls[0][0]);
    expect(logLine).toContain('"status":504');
    expect(logLine).toContain('"errorCode":"UPSTREAM_TIMEOUT"');
    expect(logLine).not.toContain('sk-sensitive-key');
  });
});
