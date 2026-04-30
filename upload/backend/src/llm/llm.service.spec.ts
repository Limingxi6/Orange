import { LlmClient } from './llm.client';
import { LlmService } from './llm.service';

describe('LlmService', () => {
  it('falls back when llm call fails for disease suggestion', async () => {
    const client = {
      chat: jest.fn().mockResolvedValue({ ok: false, text: '', error: 'X', model: 'mock-model' }),
    } as unknown as LlmClient;

    const service = new LlmService(client);

    const out = await service.suggestDiseaseAdvice({
      diseaseName: '疑似炭疽',
      confidence: 0.52,
      severity: 'mid',
      baseSuggestion: '建议复拍并人工复核。',
    });

    expect(out.fromLlm).toBe(false);
    expect(out.content.summary).toContain('疑似炭疽');
    expect(out.content.riskNote).toContain('仅供参考');
  });

  it('parses structured risk output', async () => {
    const client = {
      chat: jest.fn().mockResolvedValue({
        ok: true,
        text: JSON.stringify({ reason: '高湿高温叠加。', suggestion: '优先复查。' }),
        model: 'mock-model',
      }),
    } as unknown as LlmClient;

    const service = new LlmService(client);

    const out = await service.explainRiskResult({
      level: 'mid',
      reason: 'raw reason',
      suggestion: 'raw suggestion',
    });

    expect(out.content.reason).toContain('高湿高温');
    expect(out.content.suggestion).toContain('优先复查');
  });
});
