import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveLlmConfig } from './llm.config';
import { LlmChatOptions, LlmChatResponse, LlmMessage } from './llm.types';
import { logLlmWarn, maskApiKey, redactText } from './llm.utils';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
            type?: string;
          }>;
    };
  }>;
};

@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);

  constructor(private readonly configService: ConfigService) {}

  async chat(messages: LlmMessage[], options?: LlmChatOptions): Promise<LlmChatResponse> {
    const cfg = resolveLlmConfig(this.configService);

    if (!cfg.enabled) {
      return { ok: false, text: '', error: 'LLM_DISABLED', model: cfg.model };
    }

    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      logLlmWarn(this.logger, 'LLM config missing', {
        baseUrl: Boolean(cfg.baseUrl),
        apiKey: Boolean(cfg.apiKey),
        model: cfg.model || '<empty>',
      });
      return { ok: false, text: '', error: 'LLM_CONFIG_MISSING', model: cfg.model };
    }

    const endpoint = this.buildEndpoint(cfg.baseUrl, cfg.chatPath);

    const body = {
      model: cfg.model,
      messages,
      temperature: options?.temperature ?? cfg.defaultTemperature,
      max_tokens: options?.maxTokens ?? cfg.defaultMaxTokens,
      response_format: options?.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    };

    let attempt = 0;
    while (attempt <= cfg.maxRetries) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          const retryable = response.status >= 500 || response.status === 429;
          logLlmWarn(this.logger, 'LLM HTTP error', {
            status: response.status,
            attempt,
            retryable,
            body: redactText(errBody, 120),
            endpoint,
            model: cfg.model,
          });

          if (retryable && attempt <= cfg.maxRetries) {
            await this.delay(220 * attempt);
            continue;
          }

          return { ok: false, text: '', error: `HTTP_${response.status}`, model: cfg.model };
        }

        const data = (await response.json()) as ChatCompletionResponse;
        const text = this.extractText(data);
        if (!text) {
          return { ok: false, text: '', error: 'EMPTY_RESPONSE', raw: data, model: cfg.model };
        }

        return { ok: true, text, raw: data, model: cfg.model };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryable = attempt <= cfg.maxRetries;
        logLlmWarn(this.logger, 'LLM request exception', {
          attempt,
          retryable,
          message: redactText(message, 160),
          endpoint,
          model: cfg.model,
          apiKey: maskApiKey(cfg.apiKey),
        });

        if (retryable) {
          await this.delay(220 * attempt);
          continue;
        }

        return { ok: false, text: '', error: 'REQUEST_EXCEPTION', model: cfg.model };
      } finally {
        clearTimeout(timer);
      }
    }

    return { ok: false, text: '', error: 'RETRY_EXHAUSTED', model: cfg.model };
  }

  private extractText(payload: ChatCompletionResponse): string {
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();
    if (!Array.isArray(content)) return '';

    return content
      .map((item) => (typeof item?.text === 'string' ? item.text : ''))
      .join('')
      .trim();
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private buildEndpoint(baseUrl: string, chatPath: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    let normalizedChatPath = chatPath.startsWith('/') ? chatPath : `/${chatPath}`;

    if (
      /\/v1$/i.test(normalizedBaseUrl) &&
      normalizedChatPath.toLowerCase().startsWith('/v1/')
    ) {
      normalizedChatPath = normalizedChatPath.slice(3);
    }

    return `${normalizedBaseUrl}${normalizedChatPath}`;
  }
}

