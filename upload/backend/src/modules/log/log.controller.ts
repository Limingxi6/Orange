import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateLogDto } from './dto/create-log.dto';
import { QueryLogDto } from './dto/query-log.dto';
import { LogService } from './log.service';

@ApiTags('log')
@ApiBearerAuth('JWT')
@Controller('logs')
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Get()
  @ApiOperation({ summary: '获取批次日志列表（时间线）' })
  @ApiQuery({ name: 'batchId', required: true, description: '批次ID', example: 1 })
  @ApiQuery({ name: 'type', required: false, description: '日志类型筛选', example: 'fertilization' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: [
          {
            id: 101,
            batchId: 1,
            type: 'fertilization',
            title: '施肥记录',
            content: '春季追肥，施用复合肥 15kg/亩',
            operatorId: 1,
            operationDate: '2026-03-16T09:30:00.000Z',
            images: ['https://example.com/log-1.jpg'],
            createdAt: '2026-03-16T09:35:00.000Z',
            time: '2026-03-16 09:30',
            operator: '测试用户',
            detail: null,
          },
        ],
      },
    },
  })
  getListByBatch(@Query() query: QueryLogDto) {
    return this.logService.getList(query);
  }

  @Post()
  @ApiOperation({ summary: '新建农事日志' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          id: 102,
          batchId: 1,
          type: 'irrigation',
          title: '浇水记录',
          content: '灌溉一次，土壤湿度恢复至 65%',
          operatorId: 1,
          operationDate: '2026-03-16T10:00:00.000Z',
          images: [],
          createdAt: '2026-03-16T10:00:00.000Z',
          time: '2026-03-16 10:00',
          operator: '测试用户',
          detail: null,
        },
      },
    },
  })
  create(
    @Body() dto: CreateLogDto,
    @CurrentUser('id') currentUserId: number,
  ) {
    return this.logService.create(dto, currentUserId);
  }

  @Get('types')
  @ApiOperation({ summary: '获取日志类型字典' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: [
          { label: '施肥', value: 'fertilization', icon: 'flower-o' },
          { label: '浇水', value: 'irrigation', icon: 'drop' },
          { label: '喷药', value: 'pesticide', icon: 'shield-o' },
          { label: '修剪', value: 'pruning', icon: 'scissors' },
          { label: '采摘', value: 'harvest', icon: 'shopping-cart-o' },
          { label: '巡检', value: 'inspection', icon: 'scan' },
        ],
      },
    },
  })
  getTypes() {
    return this.logService.getTypes();
  }
}

