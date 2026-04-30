import { createHash } from 'crypto';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function sortObject(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }

  if (value && typeof value === 'object') {
    const sortedEntries = Object.keys(value)
      .sort()
      .map((key) => [key, sortObject((value as { [key: string]: JsonValue })[key])] as const);
    return Object.fromEntries(sortedEntries);
  }

  return value;
}

export function createContentHash(payload: unknown): string {
  const normalized = sortObject((payload ?? null) as JsonValue);
  const text = JSON.stringify(normalized);
  return createHash('sha256').update(text).digest('hex');
}
