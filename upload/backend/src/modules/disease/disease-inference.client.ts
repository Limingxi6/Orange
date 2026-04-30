import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mockRecognizeDisease } from './mock-disease-recognizer';

type Severity = 'low' | 'mid' | 'high';

export type DiseaseInferenceResult = {
  diseaseName: string;
  confidence: number;
  severity: Severity;
  suggestion: string;
  modelVersion: string;
  boxes: unknown[];
  needManualReview?: boolean;
  advice?: string;
  reasoning?: string;
  severityText?: string;
};

type InferenceApiResponse =
  | DiseaseInferenceResult
  | {
      data?: Partial<DiseaseInferenceResult>;
      diseaseName?: string;
      confidence?: number;
      severity?: Severity;
      suggestion?: string;
      modelVersion?: string;
      boxes?: unknown[];
      needManualReview?: boolean;
      advice?: string;
      reasoning?: string;
      severityText?: string;
    };

@Injectable()
export class DiseaseInferenceClient {
  private readonly logger = new Logger(DiseaseInferenceClient.name);

  constructor(private readonly configService: ConfigService) {}

  //AI 辅助生成：DeepSeek-V3, 2026-4-26）
  async infer(imageUrl: string, batchId: number): Promise<DiseaseInferenceResult> {
    const enableAiMock = this.configService.get<boolean>('aiService.enableMock', false);
    const baseUrl =
      this.configService.get<string>('diseaseInference.baseUrl') ||
      this.configService.get<string>('aiService.url');
    const path = this.configService.get<string>('diseaseInference.predictPath', '/predict');
    const timeoutMs =
      this.configService.get<number>('diseaseInference.timeoutMs') ||
      this.configService.get<number>('aiService.timeoutMs', 15000);
    const apiKey = this.configService.get<string>('diseaseInference.apiKey');
    const modelPath = this.configService.get<string>('aiService.modelPath');

    if (enableAiMock) {
      this.logger.warn('ENABLE_AI_MOCK=true, fallback to local rule inference');
      return this.inferWithLocalRule(imageUrl);
    }

    if (!baseUrl) {
      this.logger.warn('AI inference base url is not configured, fallback to local rule inference');
      return this.inferWithLocalRule(imageUrl);
    }

    const endpoint = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ imageUrl, batchId, modelPath }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.logger.warn(
          `Disease inference HTTP failed, status=${response.status}, body=${errorBody || '<empty>'}`,
        );
        return this.inferWithLocalRule(imageUrl);
      }

      const payload = (await response.json()) as InferenceApiResponse;
      const normalized = this.normalizeResponse(payload);

      if (!normalized) {
        this.logger.warn('Disease inference response shape invalid, fallback to local rule inference');
        return this.inferWithLocalRule(imageUrl);
      }

      return normalized;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Disease inference request error: ${reason}; fallback to local rule inference`);
      return this.inferWithLocalRule(imageUrl);
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeResponse(payload: InferenceApiResponse): DiseaseInferenceResult | null {
    const source = 'data' in payload && payload.data ? payload.data : payload;

    const diseaseName = source.diseaseName;
    const confidence = source.confidence;
    const severity = source.severity;
    const suggestion = source.suggestion;
    const modelVersion = source.modelVersion;
    const boxes = source.boxes;
    const needManualReview = source.needManualReview;
    const advice = source.advice;
    const reasoning = source.reasoning;
    const severityText = source.severityText;

    if (
      typeof diseaseName !== 'string' ||
      typeof confidence !== 'number' ||
      (severity !== 'low' && severity !== 'mid' && severity !== 'high') ||
      typeof suggestion !== 'string' ||
      typeof modelVersion !== 'string' ||
      !Array.isArray(boxes)
    ) {
      return null;
    }

    return {
      diseaseName,
      confidence,
      severity,
      suggestion,
      modelVersion,
      boxes,
      needManualReview: typeof needManualReview === 'boolean' ? needManualReview : undefined,
      advice: typeof advice === 'string' ? advice : undefined,
      reasoning: typeof reasoning === 'string' ? reasoning : undefined,
      severityText: typeof severityText === 'string' ? severityText : undefined,
    };
  }

  private inferWithLocalRule(imageUrl: string): DiseaseInferenceResult {
    const last = imageUrl.split('/').pop();
    const filename = (last && last.trim()) || `batch-${Date.now()}`;
    const local = mockRecognizeDisease(filename);

    return {
      diseaseName: local.diseaseName,
      confidence: local.confidence,
      severity: local.severity,
      suggestion: local.suggestion,
      modelVersion: 'rule-local-v1',
      boxes: [],
      needManualReview: local.severity === 'high',
    };
  }
}
