import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AiNarrativeService } from '../ai/ai-narrative.service';
import { UploadService } from '../upload/upload.service';
import { DiseaseInferenceClient } from './disease-inference.client';
import { QueryDiseaseRecordsDto } from './dto/query-disease-records.dto';

type PredictDiseaseInput = {
  batchId?: number;
  imageUrl?: string;
};

@Injectable()
export class DiseaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly diseaseInferenceClient: DiseaseInferenceClient,
    private readonly aiNarrativeService: AiNarrativeService,
  ) {}

  async predict(
    file: Express.Multer.File,
    dto: PredictDiseaseInput,
    userId: number,
    req: Request,
  ) {
    const batchId = await this.resolveBatchId(dto.batchId, userId);
    const finalImageUrl =
      dto.imageUrl?.trim() || (file ? (await this.uploadService.uploadImage(file, req)).url : '');

    if (!finalImageUrl) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, 'Please upload an image or provide imageUrl');
    }

    const inferResult = await this.diseaseInferenceClient.infer(finalImageUrl, batchId);

    const needManualReview = inferResult.needManualReview ?? inferResult.severity === 'high';
    const status = needManualReview ? 'review' : 'normal';

    const suggestionTask = await this.aiNarrativeService.suggestDiseaseAdvice({
      diseaseName: inferResult.diseaseName,
      confidence: inferResult.confidence,
      severity: inferResult.severity,
      baseSuggestion: inferResult.suggestion,
    });

    const baseSuggestion = inferResult.suggestion;
    const aiSuggestion = {
      title: suggestionTask.content.title,
      summary: suggestionTask.content.summary,
      actions: suggestionTask.content.actions.slice(0, 3),
      riskNote: suggestionTask.content.riskNote,
    };

    const enhancedSuggestion = this.composeSuggestionText(aiSuggestion);

    const record = await this.prisma.diseaseRecord.create({
      data: {
        batchId,
        imageUrl: finalImageUrl,
        diseaseName: inferResult.diseaseName,
        confidence: inferResult.confidence,
        suggestion: baseSuggestion,
        severity: inferResult.severity,
        status,
        rawResult: {
          modelVersion: inferResult.modelVersion,
          boxes: inferResult.boxes,
          baseSuggestion,
          aiSuggestion,
          aiEnhancedText: enhancedSuggestion,
          aiFromLlm: suggestionTask.fromLlm,
          aiTaskMeta: suggestionTask.meta,
          needManualReview,
          reasoning: inferResult.reasoning,
          severityText: inferResult.severityText,
        } as Prisma.InputJsonValue,
        createdBy: userId,
      },
      select: {
        id: true,
        batchId: true,
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
    const manualReview = rawResult?.needManualReview;
    const reasoning = rawResult?.reasoning;
    const severityText = rawResult?.severityText;

    return {
      id: record.id,
      batchId: record.batchId,
      imageUrl: record.imageUrl,
      diseaseName: record.diseaseName,
      confidence: record.confidence,
      severity: record.severity,
      suggestion: record.suggestion,
      aiSuggestion,
      suggestionDetail: aiSuggestion,
      enhancedSuggestion,
      modelVersion: typeof modelVersion === 'string' ? modelVersion : '',
      boxes: Array.isArray(boxes) ? boxes : [],
      needManualReview: typeof manualReview === 'boolean' ? manualReview : record.severity === 'high',
      reasoning: typeof reasoning === 'string' ? reasoning : '',
      severityText: typeof severityText === 'string' ? severityText : '',
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

  private composeSuggestionText(input: {
    title: string;
    summary: string;
    actions: string[];
    riskNote?: string;
  }) {
    const parts: string[] = [];
    if (input.summary) parts.push(input.summary);
    if (input.actions.length > 0) parts.push(`建议：${input.actions.join('；')}`);
    if (input.riskNote) parts.push(input.riskNote);
    return parts.join(' ');
  }

  private async resolveBatchId(batchId: number | undefined, userId: number) {
    if (typeof batchId === 'number' && batchId > 0) {
      const batch = await this.prisma.batch.findUnique({
        where: { id: batchId },
        select: { id: true },
      });
      if (!batch) {
        throw new BusinessException(ErrorCode.NOT_FOUND, 'Batch not found');
      }
      return batch.id;
    }

    const latest = await this.prisma.batch.findFirst({
      where: { managerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!latest) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'batchId is required when no managed batch exists for current user',
      );
    }

    return latest.id;
  }
}
