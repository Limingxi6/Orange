import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QueryRiskSummaryDto } from './dto/query-risk-summary.dto';
import { QueryRiskAssessmentDto } from './dto/query-risk-assessment.dto';
import { QueryRiskHistoryDto } from './dto/query-risk-history.dto';
import { RiskService } from './risk.service';

@ApiTags('risk')
@ApiBearerAuth('JWT')
@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('summary')
  @ApiOperation({ summary: '风险摘要' })
  @ApiQuery({ name: 'batchId', required: false, example: 1 })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          total: 6,
          high: 2,
          medium: 3,
          low: 1,
          latestList: [
            {
              id: 101,
              batchId: 1,
              level: 'mid',
              levelText: '中',
              summary: '未来3天连续降雨，病害扩散风险增加',
              date: '2026-03-20',
              createdAt: '2026-03-20T10:00:00.000Z',
            },
          ],
        },
      },
    },
  })
  getSummary(
    @CurrentUser('id') userId: number,
    @Query() query: QueryRiskSummaryDto,
  ) {
    return this.riskService.getSummary(userId, query);
  }

  @Get('assessment')
  @ApiOperation({ summary: '批次风险评估' })
  @ApiQuery({ name: 'batchId', required: true, example: 1 })
  @ApiResponse({
    status: 200,
    description: '评估成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          batchId: 1,
          overallLevel: 'mid',
          levelText: '中',
          riskItems: [
            {
              type: 'disease-spread',
              level: 'mid',
              title: '病害扩散风险',
              reason: '未来3天预计有2天降雨，且当前处于果实膨大期。',
              score: 28,
            },
          ],
          suggestions: ['加强巡园，重点检查病斑区域'],
          level: 'mid',
          reason: '病害扩散风险：未来3天预计有2天降雨...',
          suggestion: '加强巡园...',
          recordId: 201,
          createdAt: '2026-03-20T11:00:00.000Z',
        },
      },
    },
  })
  getAssessment(
    @CurrentUser('id') userId: number,
    @Query() query: QueryRiskAssessmentDto,
  ) {
    return this.riskService.getAssessment(userId, query);
  }

  @Get('history')
  @ApiOperation({ summary: '风险历史记录' })
  @ApiQuery({ name: 'batchId', required: false, example: 1 })
  @ApiQuery({ name: 'batch_id', required: false, example: 1 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 10 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          list: [
            {
              id: 301,
              batchId: 1,
              riskType: 'overall',
              level: 'high',
              levelText: '高',
              summary: '连续降雨且近期病害记录增加',
              suggestion: '加强巡园并尽快复查',
              sourceData: {},
              date: '2026-03-20',
              createdAt: '2026-03-20T12:00:00.000Z',
            },
          ],
          total: 12,
          page: 1,
          pageSize: 10,
        },
      },
    },
  })
  getHistory(@Query() query: QueryRiskHistoryDto) {
    return this.riskService.getHistory(query);
  }
}

