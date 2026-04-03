import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { QueryLogDto } from './dto/query-log.dto';
import { CreateLogDto } from './dto/create-log.dto';

type LogTypeItem = {
  label: string;
  value: string;
  icon: string;
};

const LOG_TYPES: LogTypeItem[] = [
  { label: '施肥', value: 'fertilization', icon: 'flower-o' },
  { label: '浇水', value: 'irrigation', icon: 'drop' },
  { label: '喷药', value: 'pesticide', icon: 'shield-o' },
  { label: '修剪', value: 'pruning', icon: 'scissors' },
  { label: '采摘', value: 'harvest', icon: 'shopping-cart-o' },
  { label: '巡检', value: 'inspection', icon: 'scan' },
];

@Injectable()
export class LogService {
  constructor(private readonly prisma: PrismaService) {}

  async getList(query: QueryLogDto) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: query.batchId },
      select: { id: true },
    });
    if (!batch) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
    }

    const list = await this.prisma.farmingLog.findMany({
      where: {
        batchId: query.batchId,
        ...(query.type ? { type: query.type } : {}),
      },
      orderBy: { operationDate: 'desc' },
      include: {
        operator: {
          select: {
            id: true,
            nickname: true,
            phone: true,
          },
        },
      },
    });

    return list.map((item) => {
      const images = this.normalizeImages(item.images);
      const operatorName = item.operator?.nickname || item.operator?.phone || `用户${item.operatorId}`;

      return {
        // 标准字段
        id: item.id,
        batchId: item.batchId,
        type: item.type,
        title: item.title,
        content: item.content,
        operatorId: item.operatorId,
        operationDate: item.operationDate,
        images,
        createdAt: item.createdAt,
        // 时间线友好字段（兼容前端现有页面）
        time: this.formatTime(item.operationDate),
        operator: operatorName,
        detail: item.detail ?? null,
      };
    });
  }

  async create(dto: CreateLogDto, currentUserId: number) {
    const batchId = dto.batchId ?? dto.batch_id;
    const type = (dto.type ?? dto.log_type)?.trim();
    const content = (dto.content ?? dto.description)?.trim();

    if (!batchId) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, 'batchId 不能为空');
    }
    if (!type) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, 'type 不能为空');
    }
    if (!content) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, 'content 不能为空');
    }

    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true },
    });
    if (!batch) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
    }

    const images = this.inputImagesToJson(dto.images, dto.image_url);
    const operationDate = dto.operationDate ? new Date(dto.operationDate) : new Date();

    const created = await this.prisma.farmingLog.create({
      data: {
        batchId,
        type,
        title: dto.title?.trim() || this.defaultTitleByType(type),
        content,
        operatorId: currentUserId,
        operationDate,
        images,
        detail: dto.source ? { source: dto.source } : undefined,
      },
      include: {
        operator: {
          select: {
            id: true,
            nickname: true,
            phone: true,
          },
        },
      },
    });

    const normalizedImages = this.normalizeImages(created.images);
    const operatorName =
      created.operator?.nickname ||
      created.operator?.phone ||
      `用户${created.operatorId}`;

    return {
      id: created.id,
      batchId: created.batchId,
      type: created.type,
      title: created.title,
      content: created.content,
      operatorId: created.operatorId,
      operationDate: created.operationDate,
      images: normalizedImages,
      createdAt: created.createdAt,
      time: this.formatTime(created.operationDate),
      operator: operatorName,
      detail: created.detail ?? null,
    };
  }

  getTypes() {
    return LOG_TYPES;
  }

  private defaultTitleByType(type: string) {
    const found = LOG_TYPES.find((x) => x.value === type);
    return found ? `${found.label}记录` : '农事记录';
  }

  private inputImagesToJson(images?: string[], imageUrl?: string) {
    if (Array.isArray(images) && images.length > 0) {
      return images;
    }
    if (imageUrl?.trim()) {
      return [imageUrl.trim()];
    }
    return [];
  }

  private normalizeImages(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((x): x is string => typeof x === 'string');
    }
    return [];
  }

  private formatTime(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }
}

