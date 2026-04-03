import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { QueryProductDto } from './dto/query-product.dto';
import { GenerateProductQrcodeDto } from './dto/generate-product-qrcode.dto';
import { createContentHash } from '../trace/utils/hash.util';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async getList(query: QueryProductDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? query.limit ?? 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProductWhereInput = {};
    const andConditions: Prisma.ProductWhereInput[] = [];

    if (query.batchId) {
      andConditions.push({ batchId: query.batchId });
    }

    if (query.grade?.trim()) {
      andConditions.push({ grade: query.grade.trim() });
    }

    if (query.status?.trim()) {
      const status = query.status.trim();
      if (status !== ProductStatus.pending && status !== ProductStatus.listed) {
        throw new BusinessException(ErrorCode.BAD_REQUEST, 'status 仅支持 pending 或 listed');
      }
      andConditions.push({ status });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
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
          batch: {
            select: {
              batchNo: true,
              variety: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      list: list.map((item) => ({
        id: item.id,
        batchId: item.batchId,
        productName: item.productName,
        grade: item.grade,
        weight: item.weight,
        unit: item.unit,
        packageType: item.packageType,
        price: item.price,
        qrCodeUrl: item.qrCodeUrl,
        status: item.status,
        createdAt: item.createdAt,
        // 兼容前端旧字段（services/product.js mock 结构）
        batchName: item.batch.batchNo,
        variety: item.batch.variety,
        qrcodeGenerated: Boolean(item.qrCodeUrl),
      })),
      total,
      page,
      pageSize,
    };
  }

  async generateQrcode(id: number, dto: GenerateProductQrcodeDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        productName: true,
        batchId: true,
      },
    });

    if (!product) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '产品不存在');
    }

    const traceLink = dto.accessUrl?.trim() || `https://trace.orange.local/products/${product.id}`;
    const traceCode =
      dto.traceCode?.trim() ||
      `P${product.id}-B${product.batchId}-${Date.now().toString(36).toUpperCase()}`;
    const qrPayload = dto.traceCode?.trim() || traceLink;

    const qrcodeBase64 = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    });

    await this.prisma.product.update({
      where: { id },
      data: {
        qrCodeUrl: traceLink,
      },
    });

    // 与 trace 模块联动：保证产品至少有一条可用溯源记录
    const existingTrace = await this.prisma.traceRecord.findFirst({
      where: { productId: product.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const placeholderPayload = {
      traceCode,
      productId: product.id,
      batchSnapshot: { batchId: product.batchId },
      logsSnapshot: [],
      inspectionsSnapshot: [],
    };
    const chainHash = createContentHash(placeholderPayload);

    if (existingTrace) {
      await this.prisma.traceRecord.update({
        where: { id: existingTrace.id },
        data: {
          traceCode,
          chainHash,
          verified: true,
        },
      });
    } else {
      await this.prisma.traceRecord.create({
        data: {
          productId: product.id,
          traceCode,
          batchSnapshot: { batchId: product.batchId },
          logsSnapshot: [],
          inspectionsSnapshot: [],
          chainHash,
          verified: true,
        },
      });
    }

    return {
      id: product.id,
      batchId: product.batchId,
      productName: product.productName,
      traceCode,
      qrCodeUrl: traceLink,
      qrcodeBase64,
    };
  }
}
