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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DiseaseService } from './disease.service';
import { AiPredictDiseaseDto } from './dto/ai-predict-disease.dto';

@ApiTags('disease')
@ApiBearerAuth('JWT')
@Controller('ai/disease')
export class AiDiseaseController {
  constructor(private readonly diseaseService: DiseaseService) {}

  @Post('predict')
  @ApiOperation({ summary: 'AI disease prediction (legacy frontend compatible)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        batchId: {
          type: 'number',
          example: 1,
        },
        batch_id: {
          type: 'number',
          example: 1,
        },
        imageUrl: {
          type: 'string',
          example: 'https://example.com/leaf.jpg',
        },
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
          label: '疑似柑橘溃疡病',
          confidence: 0.91,
          severity: 'mid',
          advice: '建议人工复核并对病斑区域进行针对性防治。',
          needManualReview: false,
          imageUrl: 'http://localhost:8080/uploads/xxx.jpg',
          image_url: 'http://localhost:8080/uploads/xxx.jpg',
          diseaseName: '疑似柑橘溃疡病',
          batchId: 1,
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async predict(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AiPredictDiseaseDto,
    @CurrentUser('id') userId: number,
    @Req() req: Request,
  ) {
    const result = await this.diseaseService.predict(
      file,
      {
        batchId: dto.batchId ?? dto.batch_id,
        imageUrl: dto.imageUrl,
      },
      userId,
      req,
    );

    const needManualReview =
      typeof (result as { needManualReview?: boolean }).needManualReview === 'boolean'
        ? Boolean((result as { needManualReview?: boolean }).needManualReview)
        : result.severity === 'high';

    return {
      ...result,
      label: result.diseaseName,
      advice: result.suggestion,
      needManualReview,
      image_url: result.imageUrl,
      aiSuggestion:
        (result as { aiSuggestion?: unknown }).aiSuggestion ||
        (result as { suggestionDetail?: unknown }).suggestionDetail ||
        null,
      suggestionDetail:
        (result as { suggestionDetail?: unknown }).suggestionDetail ||
        (result as { aiSuggestion?: unknown }).aiSuggestion ||
        null,
    };
  }
}
