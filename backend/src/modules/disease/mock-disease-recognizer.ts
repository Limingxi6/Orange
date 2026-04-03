export type MockPredictResult = {
  diseaseName: string;
  confidence: number;
  suggestion: string;
  severity: 'low' | 'mid' | 'high';
  status: 'normal' | 'review';
  rawResult: Record<string, unknown>;
};

type Rule = {
  keyword: string;
  diseaseName: string;
  confidenceRange: [number, number];
  suggestion: string;
  severity: 'low' | 'mid' | 'high';
  status: 'normal' | 'review';
};

const RULES: Rule[] = [
  {
    keyword: 'canker',
    diseaseName: '疑似柑橘溃疡病',
    confidenceRange: [0.82, 0.96],
    suggestion: '建议人工复核并对病斑区域进行针对性防治。',
    severity: 'mid',
    status: 'review',
  },
  {
    keyword: 'anthracnose',
    diseaseName: '疑似炭疽病',
    confidenceRange: [0.72, 0.9],
    suggestion: '建议清理病叶并在晴天进行预防性喷药。',
    severity: 'mid',
    status: 'normal',
  },
  {
    keyword: 'mite',
    diseaseName: '疑似红蜘蛛危害',
    confidenceRange: [0.7, 0.88],
    suggestion: '建议重点检查叶背并按虫情进行防控。',
    severity: 'low',
    status: 'normal',
  },
];

const FALLBACK_RESULTS: Omit<MockPredictResult, 'confidence' | 'rawResult'>[] = [
  {
    diseaseName: '叶片状态正常',
    suggestion: '当前未发现明显病害特征，建议继续观察。',
    severity: 'low',
    status: 'normal',
  },
  {
    diseaseName: '疑似叶斑病',
    suggestion: '建议加强巡检，必要时进行人工复核。',
    severity: 'mid',
    status: 'review',
  },
  {
    diseaseName: '疑似黄龙病早期症状',
    suggestion: '建议尽快人工确诊并隔离可疑植株。',
    severity: 'high',
    status: 'review',
  },
];

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function to2(value: number) {
  return Number(value.toFixed(2));
}

/**
 * 模拟病害识别逻辑（可替换）
 * 后续对接 Python 模型服务时，仅需替换该函数。
 */
export function mockRecognizeDisease(filename: string): MockPredictResult {
  const lower = filename.toLowerCase();
  const matched = RULES.find((r) => lower.includes(r.keyword));

  if (matched) {
    const confidence = to2(
      randomInRange(matched.confidenceRange[0], matched.confidenceRange[1]),
    );
    return {
      diseaseName: matched.diseaseName,
      confidence,
      suggestion: matched.suggestion,
      severity: matched.severity,
      status: matched.status,
      rawResult: {
        source: 'mock-rule-engine',
        matchedKeyword: matched.keyword,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const picked = FALLBACK_RESULTS[Math.floor(Math.random() * FALLBACK_RESULTS.length)];
  const confidence = to2(randomInRange(0.65, 0.92));
  return {
    ...picked,
    confidence,
    rawResult: {
      source: 'mock-random-engine',
      filename,
      timestamp: new Date().toISOString(),
    },
  };
}

