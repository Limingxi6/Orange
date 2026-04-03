import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { QueryRiskSummaryDto } from './dto/query-risk-summary.dto';
import { QueryRiskAssessmentDto } from './dto/query-risk-assessment.dto';
import { QueryRiskHistoryDto } from './dto/query-risk-history.dto';
import { RiskEngineService } from './risk-engine.service';
import { RiskLevel } from '@prisma/client';

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskEngine: RiskEngineService,
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

    // 若没有历史风险记录，动态生成一批（每个批次1条）并落库
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
      list: list.map((x) => ({
        id: x.id,
        batchId: x.batchId,
        riskType: x.riskType,
        level: x.riskLevel,
        levelText: x.levelText ?? this.riskEngine.levelText(x.riskLevel),
        summary: x.summary ?? '',
        suggestion: x.suggestion ?? '',
        sourceData: x.sourceData,
        date: x.createdAt.toISOString().slice(0, 10),
        createdAt: x.createdAt,
      })),
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
      throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
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

    const weatherCurrent = (latestWeather?.currentData as Record<string, any> | null) ?? {};
    const weatherForecast =
      (latestWeather?.forecastData as Array<Record<string, any>> | null) ?? [];

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
    const summary = assessed.riskItems
      .map((x) => `${x.title}：${x.reason}`)
      .slice(0, 2)
      .join('；');
    const suggestionText = assessed.suggestions.join('；');

    const stored = await this.prisma.riskRecord.create({
      data: {
        batchId,
        riskType: 'overall',
        riskLevel: assessed.overallLevel,
        levelText,
        summary,
        suggestion: suggestionText,
        sourceData: {
          engine: 'rule-v1',
          orchardName: batch.orchardName,
          overallScore: assessed.overallScore,
          riskItems: assessed.riskItems,
          weather: {
            current: weatherCurrent,
            forecastCount: weatherForecast.length,
          },
          diseasesIn7d: recentDiseases.length,
        },
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
      // 兼容前端旧字段
      level: assessed.overallLevel,
      reason: summary,
      suggestion: suggestionText,
      recordId: stored.id,
      createdAt: stored.createdAt,
    };
  }
}

