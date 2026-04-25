import { AiNarrativeService } from './ai-narrative.service';
import { LlmService } from '../../llm/llm.service';

describe('AiNarrativeService', () => {
  it('returns disease fallback text from llm service', async () => {
    const llmService = {
      suggestDiseaseAdvice: jest.fn().mockResolvedValue({
        content: {
          title: '病害识别建议',
          summary: '识别结果为疑似柑橘溃疡病，建议复核。',
          actions: ['24小时内复核'],
        },
        fromLlm: false,
      }),
    } as unknown as LlmService;

    const service = new AiNarrativeService(llmService);

    const text = await service.explainDiseaseResult({
      diseaseName: '疑似柑橘溃疡病',
      confidence: 0.91,
      severity: 'mid',
      baseSuggestion: '建议巡园复核',
    });

    expect(text).toContain('建议复核');
  });

  it('uses structured risk explanation from llm service', async () => {
    const llmService = {
      suggestRiskAdvice: jest.fn().mockResolvedValue({
        content: {
          title: '风险处置建议',
          summary: '降雨叠加高湿，病害扩散风险偏高。',
          actions: ['48小时内完成重点区域复查。'],
        },
        fromLlm: true,
      }),
    } as unknown as LlmService;

    const service = new AiNarrativeService(llmService);

    const result = await service.polishRiskAssessment({
      level: 'high',
      reason: 'raw reason',
      suggestion: 'raw suggestion',
    });

    expect(result.reason).toContain('风险偏高');
    expect(result.suggestion).toContain('48小时');
  });
});
