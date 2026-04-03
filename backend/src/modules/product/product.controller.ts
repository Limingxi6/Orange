import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { QueryProductDto } from './dto/query-product.dto';
import { GenerateProductQrcodeDto } from './dto/generate-product-qrcode.dto';

@ApiTags('product')
@ApiBearerAuth('JWT')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: '获取产品列表（支持批次/等级/状态/分页）' })
  @ApiQuery({ name: 'batchId', required: false, example: 1 })
  @ApiQuery({ name: 'grade', required: false, example: '一级果' })
  @ApiQuery({ name: 'status', required: false, example: 'listed' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 10 })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: '兼容前端分页字段' })
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
              batchName: '2026春-纽荷尔脐橙A区',
              variety: '纽荷尔脐橙',
              qrcodeGenerated: true,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      },
    },
  })
  getList(@Query() query: QueryProductDto) {
    return this.productService.getList(query);
  }

  @Post(':id/qrcode')
  @ApiOperation({ summary: '生成产品二维码并更新 qrCodeUrl' })
  @ApiParam({ name: 'id', example: 1, description: '产品 ID' })
  @ApiResponse({
    status: 200,
    description: '生成成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          id: 1,
          batchId: 1001,
          productName: '纽荷尔脐橙礼盒',
          traceCode: 'P1-B1001-KS8Q1A',
          qrCodeUrl: 'https://trace.orange.local/products/1',
          qrcodeBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        },
      },
    },
  })
  generateQrcode(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateProductQrcodeDto,
  ) {
    return this.productService.generateQrcode(id, dto);
  }
}
