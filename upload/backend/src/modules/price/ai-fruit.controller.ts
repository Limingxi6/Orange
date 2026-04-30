import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { UploadService } from '../upload/upload.service';
import { PriceService } from './price.service';
import { AiFruitGradeDto } from './dto/ai-fruit-grade.dto';

@ApiTags('price')
@ApiBearerAuth('JWT')
@Controller('ai/fruit')
export class AiFruitController {
  constructor(
    private readonly priceService: PriceService,
    private readonly uploadService: UploadService,
  ) {}

  @Post('grade')
  @ApiOperation({ summary: 'AI fruit grading and pricing (legacy frontend compatible)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        batchId: { type: 'number', example: 1 },
        batch_id: { type: 'number', example: 1 },
        imageUrl: { type: 'string', example: 'https://example.com/fruit.jpg' },
        channel: { type: 'string', example: '电商' },
        packageType: { type: 'string', example: '礼盒' },
        packaging: { type: 'string', example: '简装' },
        region: { type: 'string', example: '湖北宜昌' },
        diameter: { type: 'number', example: 75 },
        brix: { type: 'number', example: 12.5 },
        weight: { type: 'number', example: 180 },
        defectLevel: { type: 'string', enum: ['low', 'mid', 'high'] },
      },
    },
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          gradeCode: 'A',
          grade: '一级果',
          colorScore: 92,
          defectRatio: 0.03,
          sizeScore: 88,
          maturityScore: 90,
          retailMinPrice: 6.8,
          retailMaxPrice: 8.2,
          wholesaleMinPrice: 4.3,
          wholesaleMaxPrice: 5.6,
          reason: '色泽与成熟度较好，适合电商礼盒销售。',
          riskWarning: '糖度缺失时建议人工复核。',
          source: {
            engine: 'python-ai',
            decision: 'rule-engine',
          },
          modelVersion: 'fruit-perception-v1',
          requestId: 'uuid',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async grade(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AiFruitGradeDto,
    @Req() req: Request,
  ) {
    const imageUrl =
      dto.imageUrl?.trim() || (file ? (await this.uploadService.uploadImage(file, req)).url : '');

    return this.priceService.aiGrade({
      batchId: dto.batchId ?? dto.batch_id,
      imageUrl,
      channel: dto.channel,
      packageType: dto.packageType ?? dto.packaging,
      region: dto.region,
      diameter: dto.diameter,
      brix: dto.brix,
      weight: dto.weight,
      defectLevel: dto.defectLevel,
    });
  }
}

