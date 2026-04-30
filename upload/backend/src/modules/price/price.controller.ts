import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PriceService } from './price.service';
import { GradeAndPriceDto } from './dto/grade-and-price.dto';
import { QueryBaselineDto } from './dto/query-baseline.dto';
import { QuerySuggestionDto } from './dto/query-suggestion.dto';

@ApiTags('price')
@ApiBearerAuth('JWT')
@Controller('price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Post('grade')
  @ApiOperation({ summary: '果实分级与规则定价' })
  @ApiResponse({
    status: 201,
    description: '计算成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          grade: 'A',
          basePrice: 7.2,
          finalPrice: 8.94,
          channelCoeff: 1.08,
          packageCoeff: 1.15,
          priceRange: { min: 8.22, max: 9.65 },
          suggestion: '建议按一级果在ecommerce渠道销售...',
        },
      },
    },
  })
  gradeAndPrice(@Body() dto: GradeAndPriceDto) {
    return this.priceService.gradeAndPrice(dto);
  }

  @Get('baseline')
  @ApiOperation({ summary: '获取基准价格配置' })
  @ApiQuery({ name: 'variety', required: false, example: '纽荷尔脐橙' })
  @ApiQuery({ name: 'region', required: false, example: '湖北宜城' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          variety: '纽荷尔脐橙',
          region: '湖北宜城',
          basePrice: 7.2,
          unit: '元/斤',
        },
      },
    },
  })
  getBaseline(@Query() query: QueryBaselineDto) {
    return this.priceService.getBaseline(query);
  }

  @Get('suggestion')
  @ApiOperation({ summary: '获取建议定价文本' })
  @ApiQuery({ name: 'batchId', required: false, example: 1 })
  @ApiQuery({ name: 'grade', required: false, example: 'A' })
  @ApiQuery({ name: 'channel', required: false, example: 'ecommerce' })
  @ApiQuery({ name: 'packageType', required: false, example: 'gift' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          grade: 'A',
          channel: 'ecommerce',
          packageType: 'gift',
          suggestion: '建议主推电商礼盒规格，突出高糖度与溯源信息。',
        },
      },
    },
  })
  getSuggestion(@Query() query: QuerySuggestionDto) {
    return this.priceService.getSuggestion(query);
  }
}

