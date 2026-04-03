import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { GradeAndPriceDto } from './dto/grade-and-price.dto';
import { QueryBaselineDto } from './dto/query-baseline.dto';
import { QuerySuggestionDto } from './dto/query-suggestion.dto';
import { calculatePrice, determineGrade } from './price-engine';

@Injectable()
export class PriceService {
  constructor(private readonly prisma: PrismaService) {}

  async gradeAndPrice(dto: GradeAndPriceDto) {
    if (dto.batchId) {
      const batch = await this.prisma.batch.findUnique({
        where: { id: dto.batchId },
        select: { id: true },
      });
      if (!batch) {
        throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
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

  getBaseline(query: QueryBaselineDto) {
    const variety = query.variety || '纽荷尔脐橙';
    const region = query.region || '湖北宜城';
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
      // 若未提供 grade，可基于批次最近病害情况做一个粗略默认建议
      const batch = await this.prisma.batch.findUnique({
        where: { id: query.batchId },
        select: { id: true, stage: true },
      });
      if (!batch) {
        throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
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
}

