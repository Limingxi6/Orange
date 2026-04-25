import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FruitPerceptionResult, NormalizedAiFruitInput } from './fruit-perception.types';

type RemotePerceptionPayload = {
  colorScore?: unknown;
  defectRatio?: unknown;
  sizeScore?: unknown;
  maturityScore?: unknown;
  detectedDiameter?: unknown;
  confidence?: unknown;
  modelVersion?: unknown;
  engine?: unknown;
  rawResult?: unknown;
};

@Injectable()
export class FruitInferenceClient {
  private readonly logger = new Logger(FruitInferenceClient.name);

  constructor(private readonly configService: ConfigService) {}

  async inferPerception(input: NormalizedAiFruitInput): Promise<FruitPerceptionResult | null> {
    const enableAiMock = this.configService.get<boolean>('aiService.enableMock', false);
    if (enableAiMock) {
      this.logger.warn('ENABLE_AI_MOCK=true, skip remote fruit perception');
      return null;
    }

    const baseUrl = this.configService.get<string>('aiService.url');
    if (!baseUrl) {
      return null;
    }

    const timeoutMs = this.configService.get<number>('aiService.timeoutMs', 15000);
    const modelPath = this.configService.get<string>('aiService.modelPath');
    const path = this.configService.get<string>('aiService.fruitPerceptionPath', '/ai/fruit/perception');
    const endpoint = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...input, modelPath }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `Fruit perception HTTP failed: status=${response.status}, body=${body || '<empty>'}`,
        );
        return null;
      }

      const data = (await response.json()) as RemotePerceptionPayload;
      return this.toPerceptionResult(data);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Fruit perception request error: ${reason}; fallback to local perception`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private toPerceptionResult(payload: RemotePerceptionPayload): FruitPerceptionResult | null {
    const colorScore = this.toNumber(payload.colorScore);
    const defectRatio = this.toNumber(payload.defectRatio);
    const sizeScore = this.toNumber(payload.sizeScore);
    const maturityScore = this.toNumber(payload.maturityScore);

    if (
      colorScore === null ||
      defectRatio === null ||
      sizeScore === null ||
      maturityScore === null
    ) {
      this.logger.warn('Fruit perception response missing score fields, fallback to local perception');
      return null;
    }

    const detectedDiameter = this.toNumber(payload.detectedDiameter);
    const confidence = this.toNumber(payload.confidence);

    return {
      colorScore: this.clamp(colorScore, 0, 100),
      defectRatio: this.clamp(defectRatio, 0, 1),
      sizeScore: this.clamp(sizeScore, 0, 100),
      maturityScore: this.clamp(maturityScore, 0, 100),
      detectedDiameter,
      confidence,
      engine: 'python-ai',
      modelVersion:
        typeof payload.modelVersion === 'string' ? payload.modelVersion : 'fruit-perception-v1',
      rawResult: this.toRawObject(payload.rawResult) ?? (payload as Record<string, unknown>),
    };
  }

  private toRawObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

