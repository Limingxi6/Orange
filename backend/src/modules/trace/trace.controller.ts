import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TraceService } from './trace.service';

@ApiTags('trace')
@ApiBearerAuth('JWT')
@Controller('trace')
export class TraceController {
  constructor(private readonly traceService: TraceService) {}

  @Get(':code')
  @ApiOperation({ summary: '通过 traceCode 查询溯源信息' })
  @ApiParam({ name: 'code', description: '溯源码', example: 'P1-B1001-KS8Q1A' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          productInfo: {
            id: 1,
            batchId: 1001,
            productName: '纽荷尔脐橙礼盒',
            grade: '一级果',
            weight: 5,
            unit: 'kg',
            packageType: '箱装',
            price: '68',
            qrCodeUrl: 'https://trace.orange.local/products/1',
            status: 'listed',
            createdAt: '2026-03-23T10:00:00.000Z',
          },
          batchInfo: {
            id: 1001,
            batchNo: '2026春-纽荷尔脐橙A区',
            orchardName: '东区3号地',
            variety: '纽荷尔脐橙',
            area: '5亩',
            stage: '果实膨大期',
            status: '种植中',
          },
          logTimeline: [
            {
              id: 9001,
              type: 'pesticide',
              title: '喷药记录',
              content: '波尔多液预防性喷施',
              operationDate: '2026-03-10T14:00:00.000Z',
              time: '2026-03-10 14:00',
            },
          ],
          diseaseRecords: [
            {
              id: 7001,
              date: '2026-03-16',
              label: '疑似柑橘溃疡病',
              confidence: 0.91,
              severity: 'mid',
              status: 'review',
              imageUrl: '/uploads/disease-001.jpg',
              createdAt: '2026-03-16T09:30:00.000Z',
            },
          ],
          traceCode: 'P1-B1001-KS8Q1A',
          verified: true,
          chainHash: 'd7c3dd4af06d9dcf40b2b2b8bfa19ac0f897...',
          createdAt: '2026-03-23T10:01:00.000Z',
        },
      },
    },
  })
  getInfo(@Param('code') code: string) {
    return this.traceService.getInfo(code);
  }

  @Get(':code/verify')
  @ApiOperation({ summary: '验证溯源链 hash 是否匹配' })
  @ApiParam({ name: 'code', description: '溯源码', example: 'P1-B1001-KS8Q1A' })
  @ApiResponse({
    status: 200,
    description: '验证成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          traceCode: 'P1-B1001-KS8Q1A',
          exists: true,
          verified: true,
          chainHash: 'd7c3dd4af06d9dcf40b2b2b8bfa19ac0f897...',
          message: '验证通过，溯源记录未被篡改',
        },
      },
    },
  })
  verifyChain(@Param('code') code: string) {
    return this.traceService.verifyChain(code);
  }
}
