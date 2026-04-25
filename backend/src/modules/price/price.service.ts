import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AiNarrativeService } from '../ai/ai-narrative.service';
import { FruitInferenceClient } from './fruit-inference.client';
import { FruitPerceptionResult, MergedFruitFeatures, NormalizedAiFruitInput } from './fruit-perception.types';
import { GradeAndPriceDto } from './dto/grade-and-price.dto';
import { QueryBaselineDto } from './dto/query-baseline.dto';
import { QuerySuggestionDto } from './dto/query-suggestion.dto';
import { calculatePrice, determineGrade } from './price-engine';

export type AiFruitGradeInput = {
  batchId?: number;
  imageUrl?: string;
  channel?: string;
  packageType?: string;
  region?: string;
  diameter?: number;
  brix?: number;
  weight?: number;
  defectLevel?: 'low' | 'mid' | 'high';
};

type GradePriceComputation = {
  gradeCode: 'A' | 'B' | 'C';
  grade: string;
  retailMinPrice: number;
  retailMaxPrice: number;
  wholesaleMinPrice: number;
  wholesaleMaxPrice: number;
  finalPrice: number;
  qualityScore: number;
  factors: Record<string, unknown>;
};

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiNarrativeService: AiNarrativeService,
    private readonly fruitInferenceClient: FruitInferenceClient,
  ) {}

  async gradeAndPrice(dto: GradeAndPriceDto) {
    if (dto.batchId) {
      const batch = await this.prisma.batch.findUnique({
        where: { id: dto.batchId },
        select: { id: true },
      });
      if (!batch) {
        throw new BusinessException(ErrorCode.NOT_FOUND, 'Batch not found');
      }
    }

    const gradeResult = determineGrade({
      diameter: dto.diameter,
      brix: dto.brix,
      defectLevel: dto.defectLevel,
    });

    return calculatePrice({
      grade: gradeResult.grade,
      channel: dto.channel,
      packageType: dto.packageType,
    });
  }

  async aiGrade(input: AiFruitGradeInput) {
    const requestId = randomUUID();
    const normalizedInput = this.normalizeInput(input);
    const batch = await this.resolveBatch(normalizedInput.batchId);

    const perception = await this.runPerception(normalizedInput);
    const merged = this.mergeFeatures(normalizedInput, perception);
    const computation = this.computeGradeAndPrice(normalizedInput, merged);
    const response = await this.buildResponse({
      batchVariety: batch?.variety,
      normalizedInput,
      perception,
      merged,
      computation,
      requestId,
    });

    await this.persistResult({
      requestId,
      batchId: normalizedInput.batchId,
      imageUrl: normalizedInput.imageUrl,
      input: normalizedInput,
      perception,
      merged,
      response,
      computation,
    });

    return response;
  }

  getBaseline(query: QueryBaselineDto) {
    const variety = query.variety || '纽荷尔脐橙';
    const region = query.region || '湖北宜昌';
    return {
      variety,
      region,
      unit: '元/斤',
      baselineMap: {
        A: 7.2,
        B: 5.8,
        C: 4.3,
      },
      updateTime: new Date().toISOString().slice(0, 10),
    };
  }

  async getSuggestion(query: QuerySuggestionDto) {
    let grade = query.grade;

    if (!grade && query.batchId) {
      const batch = await this.prisma.batch.findUnique({
        where: { id: query.batchId },
        select: { id: true, stage: true },
      });
      if (!batch) {
        throw new BusinessException(ErrorCode.NOT_FOUND, 'Batch not found');
      }
      grade = batch.stage.includes('成熟') ? 'A' : 'B';
    }

    const resolvedGrade = grade ?? 'B';
    const priced = calculatePrice({
      grade: resolvedGrade,
      channel: query.channel,
      packageType: query.packageType,
    });

    return {
      grade: priced.grade,
      suggestedPrice: priced.finalPrice,
      priceRange: priced.priceRange,
      suggestion: priced.suggestion,
      factors: {
        basePrice: priced.basePrice,
        channelCoeff: priced.channelCoeff,
        packageCoeff: priced.packageCoeff,
      },
    };
  }

  private normalizeInput(input: AiFruitGradeInput): NormalizedAiFruitInput {
    return {
      batchId: input.batchId,
      imageUrl: input.imageUrl?.trim() || undefined,
      channel: this.normalizeChannel(input.channel),
      packageType: this.normalizePackageType(input.packageType),
      region: input.region?.trim() || undefined,
      diameter: this.toOptionalNumber(input.diameter, 30, 120),
      brix: this.toOptionalNumber(input.brix, 1, 25),
      weight: this.toOptionalNumber(input.weight, 30, 1000),
      defectLevel: input.defectLevel,
    };
  }

  private async runPerception(input: NormalizedAiFruitInput): Promise<FruitPerceptionResult> {
    const remote = await this.fruitInferenceClient.inferPerception(input);
    if (remote) {
      return remote;
    }

    return this.localPerceptionFallback(input);
  }

  private mergeFeatures(
    input: NormalizedAiFruitInput,
    perception: FruitPerceptionResult,
  ): MergedFruitFeatures {
    return {
      colorScore: this.clamp(perception.colorScore, 0, 100),
      defectRatio: this.clamp(perception.defectRatio, 0, 1),
      sizeScore: this.clamp(perception.sizeScore, 0, 100),
      maturityScore: this.clamp(perception.maturityScore, 0, 100),
      detectedDiameter: perception.detectedDiameter ?? null,
      confidence: perception.confidence ?? null,
      diameter: input.diameter,
      brix: input.brix,
      weight: input.weight,
      defectLevel: input.defectLevel,
    };
  }

  private computeGradeAndPrice(
    input: NormalizedAiFruitInput,
    merged: MergedFruitFeatures,
  ): GradePriceComputation {
    const gradeResult = determineGrade({
      diameter: merged.detectedDiameter ?? merged.diameter,
      brix: merged.brix,
      defectLevel: merged.defectLevel,
      colorScore: merged.colorScore,
      sizeScore: merged.sizeScore,
      maturityScore: merged.maturityScore,
      defectRatio: merged.defectRatio,
    });

    const priced = calculatePrice({
      grade: gradeResult.grade,
      channel: input.channel,
      packageType: input.packageType,
    });

    const retailMinPrice = Number((priced.finalPrice * 0.92).toFixed(1));
    const retailMaxPrice = Number((priced.finalPrice * 1.08).toFixed(1));
    const wholesaleMinPrice = Number((priced.finalPrice * 0.62).toFixed(1));
    const wholesaleMaxPrice = Number((priced.finalPrice * 0.72).toFixed(1));

    return {
      gradeCode: gradeResult.grade,
      grade: this.toGradeText(gradeResult.grade),
      retailMinPrice,
      retailMaxPrice,
      wholesaleMinPrice,
      wholesaleMaxPrice,
      finalPrice: priced.finalPrice,
      qualityScore: gradeResult.qualityScore,
      factors: {
        qualityScore: gradeResult.qualityScore,
        ruleFactors: gradeResult.factors,
        pricing: {
          basePrice: priced.basePrice,
          channelCoeff: priced.channelCoeff,
          packageCoeff: priced.packageCoeff,
        },
      },
    };
  }

  private async buildResponse(params: {
    batchVariety?: string;
    normalizedInput: NormalizedAiFruitInput;
    perception: FruitPerceptionResult;
    merged: MergedFruitFeatures;
    computation: GradePriceComputation;
    requestId: string;
  }) {
    const variety = params.batchVariety || '纽荷尔脐橙';

    const defaultReason = this.buildReason({
      grade: params.computation.grade,
      merged: params.merged,
      input: params.normalizedInput,
    });
    const riskWarning = this.buildRiskWarning(params.normalizedInput, params.perception);

    const adviceTask = await this.aiNarrativeService.suggestFruitAdvice({
      variety,
      grade: params.computation.grade,
      colorScore: params.merged.colorScore,
      defectRatio: Number(params.merged.defectRatio.toFixed(3)),
      sizeScore: params.merged.sizeScore,
      maturityScore: params.merged.maturityScore,
      retailMinPrice: params.computation.retailMinPrice,
      retailMaxPrice: params.computation.retailMaxPrice,
      wholesaleMinPrice: params.computation.wholesaleMinPrice,
      wholesaleMaxPrice: params.computation.wholesaleMaxPrice,
      channel: params.normalizedInput.channel,
      packageType: params.normalizedInput.packageType,
      region: params.normalizedInput.region,
      factors: params.computation.factors,
      reason: defaultReason,
      riskWarning,
    });

    const recommendation = {
      title: adviceTask.content.title,
      summary: adviceTask.content.summary || defaultReason,
      actions: adviceTask.content.actions.slice(0, 3),
      riskNote: adviceTask.content.riskNote || riskWarning,
    };

    return {
      gradeCode: params.computation.gradeCode,
      grade: params.computation.grade,
      variety,
      colorScore: params.merged.colorScore,
      defectRatio: Number(params.merged.defectRatio.toFixed(3)),
      sizeScore: params.merged.sizeScore,
      maturityScore: params.merged.maturityScore,
      retailMinPrice: params.computation.retailMinPrice,
      retailMaxPrice: params.computation.retailMaxPrice,
      wholesaleMinPrice: params.computation.wholesaleMinPrice,
      wholesaleMaxPrice: params.computation.wholesaleMaxPrice,
      reason: recommendation.summary || defaultReason,
      explanation: recommendation.summary || defaultReason,
      recommendation,
      riskWarning,
      factors: {
        ...params.computation.factors,
        perception: {
          colorScore: params.perception.colorScore,
          defectRatio: params.perception.defectRatio,
          sizeScore: params.perception.sizeScore,
          maturityScore: params.perception.maturityScore,
          detectedDiameter: params.perception.detectedDiameter ?? null,
          confidence: params.perception.confidence ?? null,
          engine: params.perception.engine,
        },
      },
      source: {
        engine: params.perception.engine,
        decision: 'rule-engine',
        adviceFromLlm: adviceTask.fromLlm,
        adviceFallback: !adviceTask.fromLlm,
      },
      modelVersion: params.perception.modelVersion || null,
      requestId: params.requestId,
    };
  }

  private async persistResult(params: {
    requestId: string;
    batchId?: number;
    imageUrl?: string;
    input: NormalizedAiFruitInput;
    perception: FruitPerceptionResult;
    merged: MergedFruitFeatures;
    response: {
      gradeCode: 'A' | 'B' | 'C';
      grade: string;
      retailMinPrice: number;
      retailMaxPrice: number;
      wholesaleMinPrice: number;
      wholesaleMaxPrice: number;
      factors: Record<string, unknown>;
      reason: string;
      riskWarning: string;
      modelVersion: string | null;
      source: {
        engine: string;
        decision: string;
      };
    };
    computation: GradePriceComputation;
  }) {
    const fruitGradeRecordClient = (this.prisma as unknown as {
      fruitGradeRecord?: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    }).fruitGradeRecord;

    if (!fruitGradeRecordClient) {
      this.logger.warn('fruitGradeRecord model is not available in Prisma client; skip persistence');
      return;
    }

    try {
      await fruitGradeRecordClient.create({
        data: {
          requestId: params.requestId,
          batchId: params.batchId,
          imageUrl: params.imageUrl,
          channel: params.input.channel,
          packageType: params.input.packageType,
          region: params.input.region,
          diameter: params.input.diameter,
          brix: params.input.brix,
          weight: params.input.weight,
          defectLevel: params.input.defectLevel,
          colorScore: params.merged.colorScore,
          defectRatio: params.merged.defectRatio,
          sizeScore: params.merged.sizeScore,
          maturityScore: params.merged.maturityScore,
          detectedDiameter: params.perception.detectedDiameter,
          confidence: params.perception.confidence,
          gradeCode: params.response.gradeCode,
          gradeText: params.response.grade,
          retailMinPrice: params.response.retailMinPrice,
          retailMaxPrice: params.response.retailMaxPrice,
          wholesaleMinPrice: params.response.wholesaleMinPrice,
          wholesaleMaxPrice: params.response.wholesaleMaxPrice,
          finalPrice: params.computation.finalPrice,
          engineSource: params.response.source.engine,
          decisionSource: params.response.source.decision,
          modelVersion: params.response.modelVersion,
          reason: params.response.reason,
          riskWarning: params.response.riskWarning,
          factors: params.response.factors,
          rawResult: params.perception.rawResult,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`fruit grade record persistence failed: ${reason}`);
    }
  }

  private localPerceptionFallback(input: NormalizedAiFruitInput): FruitPerceptionResult {
    const hasStructuredSignals =
      typeof input.diameter === 'number' ||
      typeof input.weight === 'number' ||
      typeof input.brix === 'number' ||
      typeof input.defectLevel === 'string';

    const sizeScore = this.scoreByDiameterOrWeight(input.diameter, input.weight);
    const maturityScore = this.scoreByBrix(input.brix);
    const defectRatio = this.defectRatioByLevel(input.defectLevel);

    return {
      colorScore: 72,
      defectRatio,
      sizeScore,
      maturityScore,
      detectedDiameter: input.diameter ?? null,
      confidence: hasStructuredSignals ? 0.68 : 0.4,
      engine: hasStructuredSignals ? 'local-rule' : 'fallback-default',
      modelVersion: hasStructuredSignals ? 'local-perception-rule-v1' : 'fallback-default-v1',
      rawResult: {
        fallback: true,
        hasStructuredSignals,
        mappings: {
          diameter: input.diameter ?? null,
          weight: input.weight ?? null,
          brix: input.brix ?? null,
          defectLevel: input.defectLevel ?? null,
        },
      },
    };
  }

  private buildReason(params: {
    grade: string;
    merged: MergedFruitFeatures;
    input: NormalizedAiFruitInput;
  }): string {
    const defectPercent = Number((params.merged.defectRatio * 100).toFixed(1));
    const channelText = params.input.channel || 'ecommerce';
    return `评估为${params.grade}，色泽${params.merged.colorScore}分，缺陷率${defectPercent}%，果径${params.merged.sizeScore}分，成熟度${params.merged.maturityScore}分，建议结合${channelText}渠道定价区间执行。`;
  }

  private buildRiskWarning(input: NormalizedAiFruitInput, perception: FruitPerceptionResult): string {
    const warnings: string[] = [];

    if (typeof input.brix !== 'number') {
      warnings.push('糖度数据缺失，建议人工复核');
    }
    if (perception.engine !== 'python-ai') {
      warnings.push('当前感知来自本地回退逻辑，建议补充标准化图像复测');
    }
    if (perception.defectRatio > 0.12) {
      warnings.push('缺陷率偏高，建议分拣后再出货');
    }

    return warnings.length ? warnings.join('；') : '未见明显异常，建议按常规质检流程复核后出货';
  }

  private scoreByDiameterOrWeight(diameter?: number, weight?: number): number {
    if (typeof diameter === 'number') {
      return this.clamp(50 + (diameter - 55) * 1.4, 45, 98);
    }
    if (typeof weight === 'number') {
      return this.clamp(50 + (weight - 120) * 0.12, 45, 98);
    }
    return 68;
  }

  private scoreByBrix(brix?: number): number {
    if (typeof brix !== 'number') {
      return 70;
    }
    return this.clamp(50 + brix * 3.2, 45, 98);
  }

  private defectRatioByLevel(defectLevel?: 'low' | 'mid' | 'high'): number {
    if (defectLevel === 'low') return 0.03;
    if (defectLevel === 'high') return 0.16;
    if (defectLevel === 'mid') return 0.08;
    return 0.1;
  }

  private toOptionalNumber(value: unknown, min: number, max: number): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }
    return this.clamp(value, min, max);
  }

  private async resolveBatch(batchId?: number) {
    if (!batchId) {
      return null;
    }

    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        variety: true,
      },
    });

    if (!batch) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'Batch not found');
    }

    return batch;
  }

  private normalizeChannel(channel?: string): string | undefined {
    const value = channel?.trim();
    if (!value) {
      return undefined;
    }

    const lower = value.toLowerCase();
    if (lower === 'ecommerce' || value === '电商') return 'ecommerce';
    if (lower === 'wholesale' || value === '批发') return 'wholesale';
    if (lower === 'stall' || value === '摆摊') return 'stall';
    if (lower === 'supermarket' || value === '商超') return 'supermarket';
    return value;
  }

  private normalizePackageType(packageType?: string): string | undefined {
    const value = packageType?.trim();
    if (!value) {
      return undefined;
    }

    const lower = value.toLowerCase();
    if (lower === 'simple' || value === '简装') return 'simple';
    if (lower === 'gift' || value === '礼盒') return 'gift';
    if (lower === 'premium' || value === '精品礼盒') return 'premium';
    return value;
  }

  private toGradeText(grade: 'A' | 'B' | 'C') {
    if (grade === 'A') return '一级果';
    if (grade === 'B') return '二级果';
    return '三级果';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

