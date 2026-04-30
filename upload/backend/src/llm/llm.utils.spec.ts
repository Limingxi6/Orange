import { extractJsonObject, maskApiKey, parseStructuredOutput } from './llm.utils';

describe('llm.utils', () => {
  it('extracts json object from wrapped text', () => {
    const raw = 'result:\n{"reason":"ok","suggestion":"do"}\nend';
    const parsed = extractJsonObject(raw);

    expect(parsed?.reason).toBe('ok');
  });

  it('parses structured output', () => {
    const parsed = parseStructuredOutput<{ text: string }>("{\"text\":\"hello\"}");
    expect(parsed?.text).toBe('hello');
  });

  it('masks api key', () => {
    expect(maskApiKey('sk-1234567890')).toBe('sk-1***7890');
  });
});
