import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';

type Severity = 'low' | 'mid' | 'high';

export type DiseaseInferenceResult = {
  diseaseName: string;
  confidence: number;
  severity: Severity;
  suggestion: string;
  modelVersion: string;
  boxes: unknown[];
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
    };

@Injectable()
export class DiseaseInferenceClient {
  private readonly logger = new Logger(DiseaseInferenceClient.name);

  constructor(private readonly configService: ConfigService) {}

  async infer(imageUrl: string, batchId: number): Promise<DiseaseInferenceResult> {
    const baseUrl = this.configService.get<string>('diseaseInference.baseUrl');
    const path = this.configService.get<string>('diseaseInference.predictPath', '/predict');
    const timeoutMs = this.configService.get<number>('diseaseInference.timeoutMs', 15000);
    const apiKey = this.configService.get<string>('diseaseInference.apiKey');

    if (!baseUrl) {
      throw new BusinessException(
        ErrorCode.OPERATION_FAILED,
        'AI 推理服务未配置（缺少 DISEASE_AI_BASE_URL）',
      );
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
        body: JSON.stringify({ imageUrl, batchId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.logger.error(
          `AI 推理服务返回非 2xx 状态: ${response.status}, body: ${errorBody || '<empty>'}`,
        );
        throw new BusinessException(
          ErrorCode.OPERATION_FAILED,
          `AI 推理服务调用失败（HTTP ${response.status}）`,
        );
      }

      const payload = (await response.json()) as InferenceApiResponse;
      const normalized = this.normalizeResponse(payload);

      if (!normalized) {
        this.logger.error(`AI 推理服务返回结构不完整: ${JSON.stringify(payload)}`);
        throw new BusinessException(ErrorCode.OPERATION_FAILED, 'AI 推理结果格式不合法');
      }

      return normalized;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }

      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI 推理服务请求异常: ${reason}`);
      throw new BusinessException(ErrorCode.OPERATION_FAILED, `AI 推理服务不可用: ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeResponse(
    payload: InferenceApiResponse,
  ): DiseaseInferenceResult | null {
    const source = 'data' in payload && payload.data ? payload.data : payload;

    const diseaseName = source.diseaseName;
    const confidence = source.confidence;
    const severity = source.severity;
    const suggestion = source.suggestion;
    const modelVersion = source.modelVersion;
    const boxes = source.boxes;

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
    };
  }
}
