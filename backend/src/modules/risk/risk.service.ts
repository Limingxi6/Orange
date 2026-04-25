import { Injectable } from '@nestjs/common';
import { Prisma, RiskLevel } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AiNarrativeService } from '../ai/ai-narrative.service';
import { QueryRiskAssessmentDto } from './dto/query-risk-assessment.dto';
import { QueryRiskHistoryDto } from './dto/query-risk-history.dto';
import { QueryRiskSummaryDto } from './dto/query-risk-summary.dto';
import { RiskEngineService } from './risk-engine.service';

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskEngine: RiskEngineService,
    private readonly aiNarrativeService: AiNarrativeService,
  ) {}

  async getSummary(userId: number, query: QueryRiskSummaryDto) {
    let batchIds: number[] = [];
    if (query.batchId) {
      batchIds = [query.batchId];
    } else {
      const mine = await this.prisma.batch.findMany({
        where: { managerId: userId },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      batchIds = mine.map((x) => x.id);
    }

    if (batchIds.length === 0) {
      return { total: 0, high: 0, medium: 0, low: 0, latestList: [] };
    }

    const existing = await this.prisma.riskRecord.findMany({
      where: { batchId: { in: batchIds } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        batchId: true,
        riskLevel: true,
        levelText: true,
        summary: true,
        createdAt: true,
      },
    });

    if (existing.length === 0) {
      for (const id of batchIds.slice(0, 5)) {
        await this.assessAndStore(id);
      }
    }

    const records =
      existing.length > 0
        ? existing
        : await this.prisma.riskRecord.findMany({
            where: { batchId: { in: batchIds } },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              batchId: true,
              riskLevel: true,
              levelText: true,
              summary: true,
              createdAt: true,
            },
          });

    const high = records.filter((x) => x.riskLevel === RiskLevel.high).length;
    const medium = records.filter((x) => x.riskLevel === RiskLevel.mid).length;
    const low = records.filter((x) => x.riskLevel === RiskLevel.low).length;

    return {
      total: records.length,
      high,
      medium,
      low,
      latestList: records.slice(0, 10).map((x) => ({
        id: x.id,
        batchId: x.batchId,
        level: x.riskLevel,
        levelText: x.levelText ?? this.riskEngine.levelText(x.riskLevel),
        summary: x.summary ?? '',
        date: x.createdAt.toISOString().slice(0, 10),
        createdAt: x.createdAt,
      })),
    };
  }

  async getAssessment(_userId: number, query: QueryRiskAssessmentDto) {
    const result = await this.assessAndStore(query.batchId);
    return result;
  }

  async getHistory(query: QueryRiskHistoryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? query.limit ?? 10;
    const skip = (page - 1) * pageSize;
    const batchId = query.batchId ?? query.batch_id;

    const where = batchId ? { batchId } : {};

    const [list, total] = await Promise.all([
      this.prisma.riskRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          batchId: true,
          riskType: true,
          riskLevel: true,
          levelText: true,
          summary: true,
          suggestion: true,
          sourceData: true,
          createdAt: true,
        },
      }),
      this.prisma.riskRecord.count({ where }),
    ]);

    return {
      list: list.map((x) => {
        const sourceData = this.asRecord(x.sourceData);
        const aiAdvice = this.extractAiAdvice(sourceData, x.summary ?? '', x.suggestion ?? '');

        return {
          id: x.id,
          batchId: x.batchId,
          riskType: x.riskType,
          level: x.riskLevel,
          levelText: x.levelText ?? this.riskEngine.levelText(x.riskLevel),
          summary: x.summary ?? '',
          suggestion: x.suggestion ?? '',
          aiAdvice,
          enrichedSuggestion:
            aiAdvice.actions.length > 0 ? aiAdvice.actions.join('；') : x.suggestion ?? '',
          sourceData: x.sourceData,
          date: x.createdAt.toISOString().slice(0, 10),
          createdAt: x.createdAt,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  private async assessAndStore(batchId: number) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        stage: true,
        orchardName: true,
      },
    });
    if (!batch) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'Batch not found');
    }

    const latestWeather = await this.prisma.weatherCache.findFirst({
      orderBy: { weatherDate: 'desc' },
      select: {
        currentData: true,
        forecastData: true,
      },
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentDiseases, latestIrrigationLog] = await Promise.all([
      this.prisma.diseaseRecord.findMany({
        where: {
          batchId,
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          confidence: true,
          severity: true,
        },
      }),
      this.prisma.farmingLog.findFirst({
        where: {
          batchId,
          OR: [{ type: 'irrigation' }, { type: '浇水' }],
        },
        orderBy: { operationDate: 'desc' },
        select: {
          operationDate: true,
        },
      }),
    ]);

    const weatherCurrent = this.asRecord(latestWeather?.currentData);
    const weatherForecast = this.asRecordArray(latestWeather?.forecastData);

    const assessed = this.riskEngine.assess({
      stage: batch.stage,
      weather: {
        condition: String(weatherCurrent.condition ?? ''),
        temp: Number(weatherCurrent.temp ?? 0),
        humidity: Number(weatherCurrent.humidity ?? 0),
        forecastData: weatherForecast,
      },
      recentDiseaseCount: recentDiseases.length,
      recentHighDiseaseCount: recentDiseases.filter((x) => x.severity === 'high').length,
      latestDiseaseConfidence: recentDiseases[0]?.confidence,
      latestIrrigationAt: latestIrrigationLog?.operationDate ?? null,
      now: new Date(),
    });

    const levelText = this.riskEngine.levelText(assessed.overallLevel);
    const ruleReason = assessed.riskItems
      .map((x) => `${x.title}: ${x.reason}`)
      .slice(0, 2)
      .join('；');
    const ruleSuggestion = assessed.suggestions.join('；');

    const weatherSummary = `天气${String(weatherCurrent.condition ?? '-')}, 温度${Number(
      weatherCurrent.temp ?? 0,
    )}℃, 湿度${Number(weatherCurrent.humidity ?? 0)}%。`;
    const diseaseSummary = `近7天病害记录${recentDiseases.length}条, 高风险${recentDiseases.filter(
      (x) => x.severity === 'high',
    ).length}条。`;

    const adviceTask = await this.aiNarrativeService.suggestRiskAdvice({
      orchardName: batch.orchardName,
      stage: batch.stage,
      level: assessed.overallLevel,
      reason: ruleReason,
      suggestion: ruleSuggestion,
      weatherSummary,
      diseaseSummary,
      hitRules: assessed.riskItems.map((x) => ({
        title: x.title,
        reason: x.reason,
        level: x.level,
      })),
    });

    const aiAdvice = {
      title: adviceTask.content.title,
      summary: adviceTask.content.summary || ruleReason,
      actions: adviceTask.content.actions.slice(0, 3),
      riskNote: adviceTask.content.riskNote,
    };

    const enrichedSuggestion =
      aiAdvice.actions.length > 0 ? aiAdvice.actions.join('；') : ruleSuggestion;

    const stored = await this.prisma.riskRecord.create({
      data: {
        batchId,
        riskType: 'overall',
        riskLevel: assessed.overallLevel,
        levelText,
        summary: aiAdvice.summary,
        suggestion: enrichedSuggestion,
        sourceData: {
          engine: 'rule-v1',
          llmPolished: adviceTask.fromLlm,
          orchardName: batch.orchardName,
          overallScore: assessed.overallScore,
          riskItems: assessed.riskItems,
          weather: {
            current: weatherCurrent,
            forecastCount: weatherForecast.length,
          },
          diseasesIn7d: recentDiseases.length,
          aiAdvice,
          aiTaskMeta: adviceTask.meta,
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return {
      batchId,
      overallLevel: assessed.overallLevel,
      levelText,
      riskItems: assessed.riskItems,
      suggestions: assessed.suggestions,
      level: assessed.overallLevel,
      reason: aiAdvice.summary,
      suggestion: enrichedSuggestion,
      aiAdvice,
      enrichedSuggestion,
      recordId: stored.id,
      createdAt: stored.createdAt,
    };
  }

  private extractAiAdvice(
    sourceData: Record<string, unknown>,
    fallbackSummary: string,
    fallbackSuggestion: string,
  ) {
    const aiAdviceRaw = this.asRecord(sourceData.aiAdvice);

    const actions = this.normalizeActions(aiAdviceRaw.actions, fallbackSuggestion);

    return {
      title: this.safeText(aiAdviceRaw.title) || '风险处置建议',
      summary: this.safeText(aiAdviceRaw.summary) || fallbackSummary,
      actions,
      riskNote: this.safeText(aiAdviceRaw.riskNote) || undefined,
    };
  }

  private normalizeActions(value: unknown, fallback: string): string[] {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    const source = this.safeText(value) || fallback;
    if (!source) return [];

    return source
      .replace(/\r/g, '\n')
      .replace(/[；;]/g, '\n')
      .replace(/[。]\s*/g, '\n')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  private safeText(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private asRecordArray(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is Record<string, unknown> => {
      return Boolean(item) && typeof item === 'object' && !Array.isArray(item);
    });
  }
}
