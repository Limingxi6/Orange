import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { QueryDiseaseRecordsDto } from './dto/query-disease-records.dto';
import { Request } from 'express';
import { PredictDiseaseDto } from './dto/predict-disease.dto';
import { DiseaseInferenceClient } from './disease-inference.client';

@Injectable()
export class DiseaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly diseaseInferenceClient: DiseaseInferenceClient,
  ) {}

  async predict(
    file: Express.Multer.File,
    dto: PredictDiseaseDto,
    userId: number,
    req: Request,
  ) {
    const { batchId, imageUrl } = dto;
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true },
    });
    if (!batch) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
    }

    const finalImageUrl =
      imageUrl ?? (await this.uploadService.uploadImage(file, req)).url;

    if (!finalImageUrl) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        '请上传图片文件或传入 imageUrl',
      );
    }

    const inferResult = await this.diseaseInferenceClient.infer(
      finalImageUrl,
      batchId,
    );

    const status = inferResult.severity === 'high' ? 'review' : 'normal';

    const record = await this.prisma.diseaseRecord.create({
      data: {
        batchId,
        imageUrl: finalImageUrl,
        diseaseName: inferResult.diseaseName,
        confidence: inferResult.confidence,
        suggestion: inferResult.suggestion,
        severity: inferResult.severity,
        status,
        rawResult: {
          modelVersion: inferResult.modelVersion,
          boxes: inferResult.boxes,
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
      select: {
        id: true,
        imageUrl: true,
        diseaseName: true,
        confidence: true,
        severity: true,
        suggestion: true,
        rawResult: true,
        createdAt: true,
      },
    });

    const rawResult = record.rawResult as Prisma.JsonObject;
    const modelVersion = rawResult?.modelVersion;
    const boxes = rawResult?.boxes;

    return {
      id: record.id,
      imageUrl: record.imageUrl,
      diseaseName: record.diseaseName,
      confidence: record.confidence,
      severity: record.severity,
      suggestion: record.suggestion,
      modelVersion: typeof modelVersion === 'string' ? modelVersion : '',
      boxes: Array.isArray(boxes) ? boxes : [],
      createdAt: record.createdAt,
    };
  }

  async getRecords(query: QueryDiseaseRecordsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const where = query.batchId ? { batchId: query.batchId } : {};

    const [list, total] = await Promise.all([
      this.prisma.diseaseRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          batchId: true,
          imageUrl: true,
          diseaseName: true,
          confidence: true,
          suggestion: true,
          severity: true,
          status: true,
          createdBy: true,
          createdAt: true,
        },
      }),
      this.prisma.diseaseRecord.count({ where }),
    ]);

    return {
      list,
      total,
      page,
      pageSize,
    };
  }
}

