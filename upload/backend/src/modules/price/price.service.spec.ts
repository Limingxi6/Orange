import { PriceService } from './price.service';

describe('PriceService aiGrade', () => {
  function buildService(options?: {
    inferResult?: Record<string, unknown> | null;
    persistError?: boolean;
  }) {
    const prisma = {
      batch: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      fruitGradeRecord: {
        create: options?.persistError
          ? jest.fn().mockRejectedValue(new Error('db down'))
          : jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    const aiNarrativeService = {
      suggestFruitAdvice: jest.fn().mockResolvedValue({
        content: {
          title: '分级与销售建议',
          summary: '解释文本',
          actions: ['建议动作1', '建议动作2'],
          riskNote: '建议复核',
        },
        fromLlm: true,
      }),
    };

    const fruitInferenceClient = {
      inferPerception: jest.fn().mockResolvedValue(options?.inferResult ?? null),
    };

    const service = new PriceService(
      prisma as never,
      aiNarrativeService as never,
      fruitInferenceClient as never,
    );

    return { service, prisma, aiNarrativeService, fruitInferenceClient };
  }

  it('uses python-ai perception result when remote is available', async () => {
    const { service, fruitInferenceClient } = buildService({
      inferResult: {
        colorScore: 88,
        defectRatio: 0.06,
        sizeScore: 82,
        maturityScore: 79,
        detectedDiameter: 73.2,
        confidence: 0.87,
        engine: 'python-ai',
        modelVersion: 'fruit-perception-v1',
        rawResult: { source: 'remote' },
      },
    });

    const result = await service.aiGrade({
      channel: 'ecommerce',
      packageType: 'gift',
      region: '湖北宜昌',
    });

    expect(fruitInferenceClient.inferPerception).toHaveBeenCalled();
    expect(result.source.engine).toBe('python-ai');
    expect(result.source.decision).toBe('rule-engine');
    expect(result.modelVersion).toBe('fruit-perception-v1');
    expect(result.recommendation).toBeDefined();
  });

  it('falls back to local-rule perception on remote timeout', async () => {
    const { service } = buildService({ inferResult: null });

    const result = await service.aiGrade({
      diameter: 75,
      brix: 12.4,
      defectLevel: 'low',
    });

    expect(result.source.engine).toBe('local-rule');
    expect(result.gradeCode).toBeDefined();
    expect(result.retailMinPrice).toBeGreaterThan(0);
  });

  it('uses fallback-default perception when no image and no structured input', async () => {
    const { service } = buildService({ inferResult: null });

    const result = await service.aiGrade({});

    expect(result.source.engine).toBe('fallback-default');
    expect(result.modelVersion).toBe('fallback-default-v1');
  });

  it('does not block main flow when persistence fails', async () => {
    const { service } = buildService({
      inferResult: null,
      persistError: true,
    });

    const result = await service.aiGrade({
      diameter: 72,
      defectLevel: 'mid',
    });

    expect(result.gradeCode).toBeDefined();
    expect(result.reason).toBeTruthy();
  });
});
