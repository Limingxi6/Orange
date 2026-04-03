import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BatchService } from './batch.service';
import { QueryBatchDto } from './dto/query-batch.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchStageDto } from './dto/update-batch-stage.dto';

@ApiTags('batch')
@ApiBearerAuth('JWT')
@Controller('batches')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Get()
  @ApiOperation({ summary: '获取批次列表（支持关键词/阶段/分页）' })
  @ApiQuery({ name: 'keyword', required: false, description: '关键词模糊搜索' })
  @ApiQuery({ name: 'stage', required: false, description: '阶段筛选' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量', example: 10 })
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
              id: 1,
              batchNo: '2026春-纽荷尔脐橙A区',
              orchardName: '东区3号地',
              variety: '纽荷尔脐橙',
              area: '5亩',
              treeCount: 250,
              plantingDate: '2026-01-15T00:00:00.000Z',
              expectedHarvestDate: '2026-05-20T00:00:00.000Z',
              stage: '果实膨大期',
              managerId: 1,
              remark: 'MVP 种植测试数据 A',
              createdAt: '2026-03-20T10:00:00.000Z',
              updatedAt: '2026-03-20T10:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      },
    },
  })
  getList(@Query() query: QueryBatchDto) {
    return this.batchService.getList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取批次详情' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          id: 1,
          batchNo: '2026春-纽荷尔脐橙A区',
          orchardName: '东区3号地',
          variety: '纽荷尔脐橙',
          area: '5亩',
          treeCount: 250,
          plantingDate: '2026-01-15T00:00:00.000Z',
          expectedHarvestDate: '2026-05-20T00:00:00.000Z',
          stage: '果实膨大期',
          managerId: 1,
          remark: 'MVP 种植测试数据 A',
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-20T10:00:00.000Z',
          logsCount: 3,
          productsCount: 1,
        },
      },
    },
  })
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.batchService.getDetail(id);
  }

  @Post()
  @ApiOperation({ summary: '创建批次' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: { id: 1001 },
      },
    },
  })
  create(
    @Body() dto: CreateBatchDto,
    @CurrentUser('id') currentUserId: number,
  ) {
    return this.batchService.create(dto, currentUserId);
  }

  @Put(':id/stage')
  @ApiOperation({ summary: '更新批次阶段' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: { success: true },
      },
    },
  })
  updateStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBatchStageDto,
  ) {
    return this.batchService.updateStage(id, dto);
  }
}

