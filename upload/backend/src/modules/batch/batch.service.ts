import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { QueryBatchDto } from './dto/query-batch.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchStageDto } from './dto/update-batch-stage.dto';

@Injectable()
export class BatchService {
  constructor(private readonly prisma: PrismaService) {}

  async getList(query: QueryBatchDto) {
    const page = query.page ?? 1;
    const pageSize = query.limit ?? query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const sort = (query.sort || 'latest').trim().toLowerCase();
    const orderBy: Prisma.BatchOrderByWithRelationInput =
      sort === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' };

    const where: Prisma.BatchWhereInput = {};
    const andConditions: Prisma.BatchWhereInput[] = [];

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      andConditions.push({
        OR: [
          { batchNo: { contains: keyword } },
          { orchardName: { contains: keyword } },
          { variety: { contains: keyword } },
        ],
      });
    }

    if (query.stage?.trim()) {
      andConditions.push({
        stage: query.stage.trim(),
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [list, total] = await Promise.all([
      this.prisma.batch.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        select: {
          id: true,
          batchNo: true,
          orchardName: true,
          variety: true,
          area: true,
          treeCount: true,
          plantingDate: true,
          expectedHarvestDate: true,
          stage: true,
          managerId: true,
          remark: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.batch.count({ where }),
    ]);

    return {
      list,
      total,
      page,
      pageSize,
    };
  }

  async getDetail(id: number) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      select: {
        id: true,
        batchNo: true,
        orchardName: true,
        variety: true,
        area: true,
        treeCount: true,
        plantingDate: true,
        expectedHarvestDate: true,
        stage: true,
        managerId: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            farmingLogs: true,
            products: true,
          },
        },
      },
    });

    if (!batch) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
    }

    return {
      id: batch.id,
      batchNo: batch.batchNo,
      orchardName: batch.orchardName,
      variety: batch.variety,
      area: batch.area,
      treeCount: batch.treeCount,
      plantingDate: batch.plantingDate,
      expectedHarvestDate: batch.expectedHarvestDate,
      stage: batch.stage,
      managerId: batch.managerId,
      remark: batch.remark,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      logsCount: batch._count.farmingLogs,
      productsCount: batch._count.products,
    };
  }

  async create(dto: CreateBatchDto, currentUserId: number) {
    const managerId = dto.managerId ?? currentUserId;
    const batchNo = dto.batchNo?.trim() || (await this.generateBatchNo());

    const manager = await this.prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, status: true },
    });

    if (!manager || manager.status !== 'active') {
      throw new BusinessException(ErrorCode.BAD_REQUEST, '负责人不存在或不可用');
    }

    if (dto.batchNo?.trim()) {
      const existing = await this.prisma.batch.findUnique({
        where: { batchNo },
        select: { id: true },
      });
      if (existing) {
        throw new BusinessException(ErrorCode.BAD_REQUEST, '批次编号已存在');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          batchNo,
          orchardName: dto.orchardName.trim(),
          variety: dto.variety.trim(),
          area: dto.area?.trim(),
          treeCount: dto.treeCount,
          plantingDate: new Date(dto.plantingDate),
          expectedHarvestDate: dto.expectedHarvestDate
            ? new Date(dto.expectedHarvestDate)
            : null,
          stage: dto.stage?.trim() || '苗期',
          status: '种植中',
          managerId,
          remark: dto.remark?.trim(),
        },
        select: { id: true, batchNo: true },
      });

      // 为每个新批次自动初始化一条待上架产品，保证“我的产品”可见。
      await tx.product.create({
        data: {
          batchId: batch.id,
          productName: `${batch.batchNo} 产品`,
          status: ProductStatus.pending,
        },
      });

      return { id: batch.id };
    });

    return created;
  }

  async updateStage(id: number, dto: UpdateBatchStageDto) {
    const exists = await this.prisma.batch.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
    }

    await this.prisma.batch.update({
      where: { id },
      data: {
        stage: dto.stage.trim(),
        updatedAt: new Date(),
      },
    });

    return { success: true };
  }

  async remove(id: number, currentUserId: number, currentUserRole: string) {
    if (!currentUserId || !currentUserRole) {
      throw new BusinessException(
        ErrorCode.UNAUTHORIZED,
        '请先登录',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({
        where: { id },
        select: { id: true, managerId: true },
      });

      if (!batch) {
        throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
      }

      const isAdmin = currentUserRole === UserRole.ADMIN;
      if (!isAdmin && batch.managerId !== currentUserId) {
        throw new BusinessException(ErrorCode.FORBIDDEN, '无权限删除该批次');
      }

      const products = await tx.product.findMany({
        where: { batchId: id },
        select: { id: true },
      });
      const productIds = products.map((item) => item.id);

      if (productIds.length > 0) {
        await tx.traceRecord.deleteMany({
          where: { productId: { in: productIds } },
        });
      }

      await Promise.all([
        tx.farmingLog.deleteMany({ where: { batchId: id } }),
        tx.diseaseRecord.deleteMany({ where: { batchId: id } }),
        tx.riskRecord.deleteMany({ where: { batchId: id } }),
        tx.fruitGradeRecord.deleteMany({ where: { batchId: id } }),
      ]);

      await tx.product.deleteMany({ where: { batchId: id } });
      await tx.batch.delete({ where: { id } });

      return { success: true };
    });
  }

  private async generateBatchNo() {
    for (let i = 0; i < 5; i++) {
      const now = new Date();
      const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
        2,
        '0',
      )}${String(now.getDate()).padStart(2, '0')}`;
      const rand = Math.floor(Math.random() * 9000) + 1000;
      const batchNo = `B${datePart}${rand}`;

      const exists = await this.prisma.batch.findUnique({
        where: { batchNo },
        select: { id: true },
      });
      if (!exists) return batchNo;
    }
    throw new BusinessException(ErrorCode.OPERATION_FAILED, '批次编号生成失败，请重试');
  }
}
