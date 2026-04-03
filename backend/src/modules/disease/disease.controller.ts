import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DiseaseService } from './disease.service';
import { PredictDiseaseDto } from './dto/predict-disease.dto';
import { QueryDiseaseRecordsDto } from './dto/query-disease-records.dto';

@ApiTags('disease')
@ApiBearerAuth('JWT')
@Controller('disease')
export class DiseaseController {
  constructor(private readonly diseaseService: DiseaseService) {}

  @Post('predict')
  @ApiOperation({
    summary: '病害识别（上传图片或传 imageUrl + AI 推理 + 入库）',
    description: '保持接口不变：POST /api/disease/predict。文件字段名为 file，可选传 imageUrl。',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '病害图片文件',
        },
        batchId: {
          type: 'number',
          example: 1,
        },
        imageUrl: {
          type: 'string',
          example: 'https://example.com/disease/leaf.jpg',
          description: '可选，外部可访问图片地址',
        },
      },
      required: ['batchId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: '识别成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          id: 11,
          imageUrl: 'http://localhost:8080/uploads/1742450000000-uuid.jpg',
          diseaseName: '疑似柑橘溃疡病',
          confidence: 0.91,
          severity: 'mid',
          suggestion: '建议人工复核并对病斑区域进行针对性防治。',
          modelVersion: 'citrus-detector-v2.3.1',
          boxes: [{ x: 120, y: 80, w: 64, h: 48, label: 'lesion' }],
          createdAt: '2026-03-20T12:00:00.000Z',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  predict(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: PredictDiseaseDto,
    @CurrentUser('id') userId: number,
    @Req() req: Request,
  ) {
    return this.diseaseService.predict(file, dto, userId, req);
  }

  @Get('records')
  @ApiOperation({ summary: '病害识别记录列表' })
  @ApiQuery({ name: 'batchId', required: false, example: 1 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 10 })
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
              id: 11,
              batchId: 1,
              imageUrl: 'http://localhost:8080/uploads/1742450000000-uuid.jpg',
              diseaseName: '疑似柑橘溃疡病',
              confidence: 0.91,
              suggestion: '建议人工复核并对病斑区域进行针对性防治。',
              severity: 'mid',
              status: 'review',
              createdBy: 1,
              createdAt: '2026-03-20T12:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      },
    },
  })
  getRecords(@Query() query: QueryDiseaseRecordsDto) {
    return this.diseaseService.getRecords(query);
  }
}

