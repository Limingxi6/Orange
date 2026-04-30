import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { QueryProductDto } from './dto/query-product.dto';
import { GenerateProductQrcodeDto } from './dto/generate-product-qrcode.dto';
import { WechatMiniCodeService } from './wechat-mini-code.service';
import { TraceService } from '../trace/trace.service';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatMiniCodeService: WechatMiniCodeService,
    private readonly traceService: TraceService,
  ) {}

  async getList(query: QueryProductDto) {
    await this.ensureDefaultProductsForBatches(
      query.batchId && Number.isFinite(query.batchId) ? [query.batchId] : undefined,
    );

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

    const miniProgramEnabled = this.wechatMiniCodeService.isEnabled();
    const qrResult = await this.buildQrcodeImage(traceCode, traceLink, miniProgramEnabled);

    await this.prisma.product.update({
      where: { id },
      data: {
        qrCodeUrl: traceLink,
      },
    });

    // 统一复用 TraceService 生成/更新快照与 proof，避免 hash 与 snapshot 不一致导致验真失败。
    await this.traceService.createOrUpdateForProduct(product.id, traceCode);

    return {
      id: product.id,
      batchId: product.batchId,
      productName: product.productName,
      traceCode,
      qrCodeUrl: traceLink,
      qrcodeBase64: qrResult.qrcodeBase64,
      qrcodeType: qrResult.qrcodeType,
      qrcodeFallback: qrResult.qrcodeType === 'normal' && miniProgramEnabled,
      qrcodeFallbackReason: qrResult.qrcodeFallbackReason ?? null,
    };
  }

  private async buildQrcodeImage(
    traceCode: string,
    traceLink: string,
    miniProgramEnabled: boolean,
  ): Promise<{
    qrcodeBase64: string;
    qrcodeType: 'mini_program' | 'normal';
    qrcodeFallbackReason?: string;
  }> {
    let fallbackReason: string | undefined;

    if (miniProgramEnabled) {
      try {
        const miniCode = await this.wechatMiniCodeService.generateMiniProgramCode(traceCode);
        return {
          qrcodeBase64: miniCode.dataUri,
          qrcodeType: 'mini_program',
        };
      } catch (error) {
        fallbackReason = this.toSafeErrorMessage(error);
        this.logger.warn(
          `Generate mini program code failed traceCode=${traceCode}, fallback to normal qrcode, reason=${fallbackReason}`,
        );
      }
    }

    const qrPayload = traceCode || traceLink;
    const qrcodeBase64 = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    });

    return {
      qrcodeBase64,
      qrcodeType: 'normal',
      ...(fallbackReason ? { qrcodeFallbackReason: fallbackReason } : {}),
    };
  }

  private toSafeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private async ensureDefaultProductsForBatches(batchIds?: number[]) {
    const where: Prisma.BatchWhereInput = {
      ...(batchIds && batchIds.length > 0 ? { id: { in: batchIds } } : {}),
      products: { none: {} },
    };

    const batchesWithoutProducts = await this.prisma.batch.findMany({
      where,
      select: {
        id: true,
        batchNo: true,
      },
      take: 500,
    });

    if (batchesWithoutProducts.length === 0) {
      return;
    }

    const defaultProducts = batchesWithoutProducts.map((batch) => ({
      batchId: batch.id,
      productName: `${batch.batchNo} 产品`,
      status: ProductStatus.pending,
    }));

    try {
      await this.prisma.product.createMany({
        data: defaultProducts,
      });
      this.logger.log(`Auto-created default products for ${defaultProducts.length} batch(es)`);
    } catch (error) {
      const reason = this.toSafeErrorMessage(error);
      this.logger.warn(`Auto-create default products failed: ${reason}`);
    }
  }
}
