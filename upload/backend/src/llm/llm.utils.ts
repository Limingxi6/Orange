import { Logger } from '@nestjs/common';

export function maskApiKey(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export function redactText(value: string, maxLen = 240): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen)}...`;
}

export function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const text = raw.trim();
  if (!text) return null;

  const direct = safeJsonParse(text);
  if (direct) return direct;

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last <= first) return null;

  return safeJsonParse(text.slice(first, last + 1));
}

export function parseStructuredOutput<T extends Record<string, unknown>>(
  raw: string,
): Partial<T> | null {
  const parsed = extractJsonObject(raw);
  if (!parsed) return null;
  return parsed as Partial<T>;
}

export function pickText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

export function toActionList(value: unknown, maxItems = 3): string[] {
  const pushUnique = (target: string[], text: string) => {
    const item = text.trim();
    if (!item || target.includes(item)) return;
    target.push(item);
  };

  const list: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'string') continue;
      pushUnique(list, item);
      if (list.length >= maxItems) return list;
    }
    return list;
  }

  const text = pickText(value);
  if (!text) return list;

  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/[；;]/g, '\n')
    .replace(/[。]\s*/g, '\n')
    .replace(/\d+[\.、]\s*/g, '\n')
    .replace(/[-*]\s*/g, '\n');

  const chunks = normalized
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    pushUnique(list, chunk);
    if (list.length >= maxItems) break;
  }

  return list;
}

export function logLlmWarn(logger: Logger, message: string, details?: Record<string, unknown>) {
  const suffix = details ? ` ${JSON.stringify(details)}` : '';
  logger.warn(`${message}${suffix}`);
}

