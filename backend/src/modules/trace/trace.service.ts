import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { createContentHash } from './utils/hash.util';

type TraceAggregate = {
  productInfo: {
    id: number;
    batchId: number;
    productName: string;
    grade: string | null;
    weight: number | null;
    unit: string | null;
    packageType: string | null;
    price: string | null;
    qrCodeUrl: string | null;
    status: string;
    createdAt: Date;
  };
  batchInfo: {
    id: number;
    batchNo: string;
    orchardName: string;
    variety: string;
    area: string | null;
    plantingDate: Date;
    expectedHarvestDate: Date | null;
    stage: string;
    status: string;
    managerId: number;
    createdAt: Date;
  };
  logTimeline: Array<{
    id: number;
    type: string;
    title: string | null;
    content: string;
    operationDate: Date;
    time: string;
  }>;
  diseaseRecords: Array<{
    id: number;
    date: string;
    label: string;
    confidence: number;
    severity: string;
    status: string;
    imageUrl: string | null;
    createdAt: Date;
  }>;
};

@Injectable()
export class TraceService {
  constructor(private readonly prisma: PrismaService) {}

  async getInfo(code: string) {
    const traceCode = code.trim();
    if (!traceCode) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, 'traceCode 不能为空');
    }

    let record = await this.prisma.traceRecord.findUnique({
      where: { traceCode },
      select: {
        id: true,
        productId: true,
        traceCode: true,
        chainHash: true,
        verified: true,
        createdAt: true,
      },
    });

    if (!record) {
      const productId = this.resolveProductIdFromCode(traceCode);
      if (!productId) {
        throw new BusinessException(ErrorCode.NOT_FOUND, '溯源码不存在');
      }
      record = await this.generateAndPersistTraceRecord(productId, traceCode);
    }

    const aggregate = await this.buildAggregate(record.productId);

    return {
      productInfo: aggregate.productInfo,
      batchInfo: aggregate.batchInfo,
      logTimeline: aggregate.logTimeline,
      diseaseRecords: aggregate.diseaseRecords,
      traceCode: record.traceCode,
      verified: record.verified,
      chainHash: record.chainHash,
      createdAt: record.createdAt,
    };
  }

  async verifyChain(code: string) {
    const traceCode = code.trim();
    if (!traceCode) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, 'traceCode 不能为空');
    }

    let record = await this.findTraceRecordForVerify(traceCode);

    if (!record) {
      const productId = this.resolveProductIdFromCode(traceCode);
      if (!productId) {
        return {
          traceCode,
          exists: false,
          verified: false,
          chainHash: null,
          message: 'trace record 不存在',
        };
      }
      await this.generateAndPersistTraceRecord(productId, traceCode, true);
      record = await this.findTraceRecordForVerify(traceCode);
      if (!record) {
        throw new BusinessException(ErrorCode.OPERATION_FAILED, 'trace record 生成失败');
      }
    }

    const recalculated = this.calculateChainHash({
      traceCode: record.traceCode,
      productId: record.productId,
      batchSnapshot: record.batchSnapshot,
      logsSnapshot: record.logsSnapshot,
      inspectionsSnapshot: record.inspectionsSnapshot,
    });
    const verified = recalculated === record.chainHash;

    if (verified !== record.verified) {
      await this.prisma.traceRecord.update({
        where: { id: record.id },
        data: { verified },
      });
    }

    return {
      traceCode: record.traceCode,
      exists: true,
      verified,
      chainHash: record.chainHash,
      message: verified ? '验证通过，溯源记录未被篡改' : '验证失败，溯源记录可能已被篡改',
    };
  }

  async createOrUpdateForProduct(productId: number, traceCode: string) {
    return this.generateAndPersistTraceRecord(productId, traceCode, true);
  }

  private async findTraceRecordForVerify(traceCode: string) {
    return this.prisma.traceRecord.findUnique({
      where: { traceCode },
      select: {
        id: true,
        productId: true,
        traceCode: true,
        batchSnapshot: true,
        logsSnapshot: true,
        inspectionsSnapshot: true,
        chainHash: true,
        verified: true,
      },
    });
  }

  private async generateAndPersistTraceRecord(
    productId: number,
    traceCode: string,
    forceRegenerate = false,
  ) {
    const aggregate = await this.buildAggregate(productId);

    const batchSnapshot: Prisma.InputJsonValue = {
      ...aggregate.batchInfo,
    };
    const logsSnapshot: Prisma.InputJsonValue = aggregate.logTimeline.map((item) => ({
      ...item,
      operationDate: item.operationDate.toISOString(),
    }));
    const inspectionsSnapshot: Prisma.InputJsonValue = aggregate.diseaseRecords.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    }));

    const chainHash = this.calculateChainHash({
      traceCode,
      productId,
      batchSnapshot,
      logsSnapshot,
      inspectionsSnapshot,
    });

    const existingByCode = await this.prisma.traceRecord.findUnique({
      where: { traceCode },
      select: { id: true },
    });

    if (existingByCode && forceRegenerate) {
      const updated = await this.prisma.traceRecord.update({
        where: { id: existingByCode.id },
        data: {
          productId,
          batchSnapshot,
          logsSnapshot,
          inspectionsSnapshot,
          chainHash,
          verified: true,
        },
        select: {
          id: true,
          productId: true,
          traceCode: true,
          chainHash: true,
          verified: true,
          createdAt: true,
        },
      });
      return updated;
    }

    if (existingByCode) {
      const found = await this.prisma.traceRecord.findUnique({
        where: { traceCode },
        select: {
          id: true,
          productId: true,
          traceCode: true,
          chainHash: true,
          verified: true,
          createdAt: true,
        },
      });
      if (!found) {
        throw new BusinessException(ErrorCode.OPERATION_FAILED, 'trace record 查询失败');
      }
      return found;
    }

    const existingByProduct = await this.prisma.traceRecord.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (existingByProduct) {
      const updated = await this.prisma.traceRecord.update({
        where: { id: existingByProduct.id },
        data: {
          traceCode,
          batchSnapshot,
          logsSnapshot,
          inspectionsSnapshot,
          chainHash,
          verified: true,
        },
        select: {
          id: true,
          productId: true,
          traceCode: true,
          chainHash: true,
          verified: true,
          createdAt: true,
        },
      });
      return updated;
    }

    const created = await this.prisma.traceRecord.create({
      data: {
        productId,
        traceCode,
        batchSnapshot,
        logsSnapshot,
        inspectionsSnapshot,
        chainHash,
        verified: true,
      },
      select: {
        id: true,
        productId: true,
        traceCode: true,
        chainHash: true,
        verified: true,
        createdAt: true,
      },
    });

    return created;
  }

  private async buildAggregate(productId: number): Promise<TraceAggregate> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        batchId: true,
        productName: true,
        grade: true,
        weight: true,
        unit: true,
        packageType: true,
        price: true,
        qrCodeUrl: true,
        status: true,
        createdAt: true,
      },
    });

    if (!product) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '产品不存在');
    }

    const [batch, logs, diseases] = await Promise.all([
      this.prisma.batch.findUnique({
        where: { id: product.batchId },
        select: {
          id: true,
          batchNo: true,
          orchardName: true,
          variety: true,
          area: true,
          plantingDate: true,
          expectedHarvestDate: true,
          stage: true,
          status: true,
          managerId: true,
          createdAt: true,
        },
      }),
      this.prisma.farmingLog.findMany({
        where: { batchId: product.batchId },
        orderBy: { operationDate: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          operationDate: true,
        },
        take: 100,
      }),
      this.prisma.diseaseRecord.findMany({
        where: { batchId: product.batchId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          diseaseName: true,
          confidence: true,
          severity: true,
          status: true,
          imageUrl: true,
          createdAt: true,
        },
        take: 100,
      }),
    ]);

    if (!batch) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
    }

    return {
      productInfo: {
        id: product.id,
        batchId: product.batchId,
        productName: product.productName,
        grade: product.grade,
        weight: product.weight,
        unit: product.unit,
        packageType: product.packageType,
        price: product.price,
        qrCodeUrl: product.qrCodeUrl,
        status: product.status,
        createdAt: product.createdAt,
      },
      batchInfo: {
        id: batch.id,
        batchNo: batch.batchNo,
        orchardName: batch.orchardName,
        variety: batch.variety,
        area: batch.area,
        plantingDate: batch.plantingDate,
        expectedHarvestDate: batch.expectedHarvestDate,
        stage: batch.stage,
        status: batch.status,
        managerId: batch.managerId,
        createdAt: batch.createdAt,
      },
      logTimeline: logs.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        operationDate: item.operationDate,
        time: this.formatTime(item.operationDate),
      })),
      diseaseRecords: diseases.map((item) => ({
        id: item.id,
        date: item.createdAt.toISOString().slice(0, 10),
        label: item.diseaseName,
        confidence: item.confidence,
        severity: item.severity,
        status: item.status,
        imageUrl: item.imageUrl,
        createdAt: item.createdAt,
      })),
    };
  }

  private calculateChainHash(input: {
    traceCode: string;
    productId: number;
    batchSnapshot: unknown;
    logsSnapshot: unknown;
    inspectionsSnapshot: unknown;
  }) {
    return createContentHash(input);
  }

  private resolveProductIdFromCode(code: string) {
    if (/^\d+$/.test(code)) {
      return Number(code);
    }
    const matched = /^P(\d+)-/i.exec(code);
    if (matched) {
      return Number(matched[1]);
    }
    return null;
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
