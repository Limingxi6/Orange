import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { AiNarrativeService } from '../ai/ai-narrative.service';
import {
  TRACE_PROOF_PROVIDER,
  type TraceProofProvider,
  type TraceProofSnapshot,
} from './interfaces/trace-proof-provider.interface';
import {
  TRACE_ANCHOR_PROVIDER,
  type TraceAnchorProvider,
} from './interfaces/trace-anchor-provider.interface';
import type { TraceAnchorInput } from './interfaces/trace-anchor-result.interface';
import {
  TRACE_ANCHOR_STATUS,
  TRACE_PROOF_SNAPSHOT_VERSION,
  TRACE_PROOF_TYPE,
  TRACE_VERIFY_MESSAGE,
  TRACE_VERIFY_STATUS,
  type TraceAnchorStatus,
  type TraceProofType,
} from './trace.constants';
import { type TraceVerifyData } from './trace.types';
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

const TRACE_RECORD_INFO_SELECT = {
  id: true,
  productId: true,
  traceCode: true,
  proofType: true,
  proofHash: true,
  snapshotVersion: true,
  chainHash: true,
  verified: true,
  verifiedAt: true,
  verifyMessage: true,
  generatedAt: true,
  anchorStatus: true,
  createdAt: true,
} as const;

type TraceRecordInfo = Prisma.TraceRecordGetPayload<{
  select: typeof TRACE_RECORD_INFO_SELECT;
}>;

@Injectable()
export class TraceService {
  private readonly logger = new Logger(TraceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiNarrativeService: AiNarrativeService,
    private readonly configService: ConfigService,
    @Inject(TRACE_PROOF_PROVIDER)
    private readonly traceProofProvider: TraceProofProvider,
    @Inject(TRACE_ANCHOR_PROVIDER)
    private readonly traceAnchorProvider: TraceAnchorProvider,
  ) {}

  async getInfo(code: string) {
    const traceCode = code.trim();
    if (!traceCode) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, 'traceCode 娑撳秷鍏樻稉铏光敄');
    }

    let record = await this.prisma.traceRecord.findUnique({
      where: { traceCode },
      select: TRACE_RECORD_INFO_SELECT,
    });

    if (!record) {
      const productId = this.resolveProductIdFromCode(traceCode);
      if (!productId) {
        throw new BusinessException(ErrorCode.NOT_FOUND, 'trace record not found');
      }
      record = await this.generateAndPersistTraceRecord(productId, traceCode);
    }

    const aggregate = await this.buildAggregate(record.productId);
    const traceAdviceTask = await this.aiNarrativeService.suggestTraceAdvice({
      title: '溯源说明',
      audience: 'consumer',
      payload: {
        batchNo: aggregate.batchInfo.batchNo,
        orchardName: aggregate.batchInfo.orchardName,
        variety: aggregate.batchInfo.variety,
        stage: aggregate.batchInfo.stage,
        grade: aggregate.productInfo.grade,
        price: aggregate.productInfo.price,
        diseaseCount: aggregate.diseaseRecords.length,
        timelineCount: aggregate.logTimeline.length,
        verified: record.verified,
        proofType: record.proofType || TRACE_PROOF_TYPE.HASH,
        anchorStatus: this.normalizeAnchorStatus(record.anchorStatus),
      },
    });
    const traceSummary = {
      title: traceAdviceTask.content.title,
      summary: traceAdviceTask.content.summary,
      actions: traceAdviceTask.content.actions.slice(0, 3),
      riskNote: traceAdviceTask.content.riskNote,
    };
    const traceNarrative = traceSummary.summary;

    const proofHash = this.resolveProofHash(record.proofHash, record.chainHash);

    return {
      productInfo: aggregate.productInfo,
      batchInfo: aggregate.batchInfo,
      logTimeline: aggregate.logTimeline,
      diseaseRecords: aggregate.diseaseRecords,
      traceCode: record.traceCode,
      proofType: record.proofType || TRACE_PROOF_TYPE.HASH,
      proofHash,
      snapshotVersion: record.snapshotVersion,
      verified: record.verified,
      verifiedAt: record.verifiedAt,
      verifyMessage: record.verifyMessage,
      generatedAt: record.generatedAt,
      anchorStatus: this.normalizeAnchorStatus(record.anchorStatus),
      // chainHash is kept for backward compatibility and equals proofHash in hash proof mode.
      chainHash: record.chainHash,
      traceNarrative,
      traceSummary,
      buyerSummary: traceSummary,
      traceAdviceMeta: traceAdviceTask.meta,
      createdAt: record.createdAt,
    };
  }

  async verifyChain(code: string): Promise<TraceVerifyData> {
    const traceCode = code.trim();
    if (!traceCode) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, 'traceCode 娑撳秷鍏樻稉铏光敄');
    }

    let record = await this.findTraceRecordForVerify(traceCode);

    if (!record) {
      const productId = this.resolveProductIdFromCode(traceCode);
      if (!productId) {
        return this.buildVerifyResult({
          traceCode,
          exists: false,
          verified: false,
          proofHash: null,
          message: TRACE_VERIFY_MESSAGE.NOT_FOUND,
          anchorStatus: TRACE_ANCHOR_STATUS.NOT_ANCHORED,
        });
      }
      await this.generateAndPersistTraceRecord(productId, traceCode, true);
      record = await this.findTraceRecordForVerify(traceCode);
      if (!record) {
        throw new BusinessException(ErrorCode.OPERATION_FAILED, 'trace record 閻㈢喐鍨氭径杈Е');
      }
    }

    const proofSnapshot = this.buildProofSnapshot({
      traceCode: record.traceCode,
      productId: record.productId,
      batchSnapshot: record.batchSnapshot,
      logsSnapshot: record.logsSnapshot,
      inspectionsSnapshot: record.inspectionsSnapshot,
    });

    const storedProofHash = this.resolveProofHash(record.proofHash, record.chainHash);
    // Main judgment: local hash verification. On-chain anchoring is supplemental evidence only.
    let verifyResult = await this.traceProofProvider.verifyProof(
      proofSnapshot,
      storedProofHash,
    );
    let verified = verifyResult.verified;

    if (!verified && this.isLegacyPlaceholderHashMismatch(record, storedProofHash)) {
      this.logger.warn(
        `Legacy trace hash mismatch detected, auto-repair traceCode=${record.traceCode}`,
      );
      await this.generateAndPersistTraceRecord(record.productId, record.traceCode, true);
      const repairedRecord = await this.findTraceRecordForVerify(record.traceCode);
      if (repairedRecord) {
        const repairedSnapshot = this.buildProofSnapshot({
          traceCode: repairedRecord.traceCode,
          productId: repairedRecord.productId,
          batchSnapshot: repairedRecord.batchSnapshot,
          logsSnapshot: repairedRecord.logsSnapshot,
          inspectionsSnapshot: repairedRecord.inspectionsSnapshot,
        });
        const repairedProofHash = this.resolveProofHash(
          repairedRecord.proofHash,
          repairedRecord.chainHash,
        );
        verifyResult = await this.traceProofProvider.verifyProof(
          repairedSnapshot,
          repairedProofHash,
        );
        verified = verifyResult.verified;

        record = repairedRecord;
      }
    }

    const verifyMessage = verified
      ? TRACE_VERIFY_MESSAGE.VERIFIED
      : TRACE_VERIFY_MESSAGE.FAILED;
    const verifyTime = verified ? new Date() : null;
    const anchorStatus = this.normalizeAnchorStatus(record.anchorStatus);

    await this.prisma.traceRecord.update({
      where: { id: record.id },
      data: {
        verified,
        verifiedAt: verifyTime,
        verifyMessage,
        proofType: this.traceProofProvider.proofType,
        proofHash: this.resolveProofHash(record.proofHash, record.chainHash),
        anchorStatus,
      },
    });

    return this.buildVerifyResult({
      traceCode: record.traceCode,
      exists: true,
      verified,
      proofHash: this.resolveProofHash(record.proofHash, record.chainHash),
      chainHash: record.chainHash,
      message: verifyMessage,
      anchorStatus,
      proofType: this.traceProofProvider.proofType,
      txId: record.txId,
      blockNumber: record.blockNumber,
      chainProvider: record.chainProvider,
      chainNetwork: record.chainNetwork,
      anchoredAt: record.anchoredAt,
    });
  }

  private buildVerifyResult(input: {
    traceCode: string;
    exists: boolean;
    verified: boolean;
    proofHash: string | null;
    chainHash?: string | null;
    message?: string;
    anchorStatus?: TraceAnchorStatus;
    proofType?: TraceProofType;
    txId?: string | null;
    blockNumber?: string | null;
    chainProvider?: string | null;
    chainNetwork?: string | null;
    anchoredAt?: Date | null;
  }): TraceVerifyData {
    const status = input.verified
      ? TRACE_VERIFY_STATUS.VERIFIED
      : TRACE_VERIFY_STATUS.FAILED;
    const anchorStatus = input.anchorStatus ?? TRACE_ANCHOR_STATUS.NOT_ANCHORED;

    return {
      traceCode: input.traceCode,
      exists: input.exists,
      verified: input.verified,
      status,
      message: input.message || (input.verified ? TRACE_VERIFY_MESSAGE.VERIFIED : TRACE_VERIFY_MESSAGE.FAILED),
      proofType: input.proofType ?? this.traceProofProvider.proofType,
      proofHash: input.proofHash,
      anchorStatus,
      txId: input.txId ?? null,
      blockNumber: input.blockNumber ?? null,
      chainProvider: input.chainProvider ?? null,
      chainNetwork: input.chainNetwork ?? null,
      anchoredAt: input.anchoredAt ?? null,
      // backward compatibility
      chainHash: input.chainHash ?? input.proofHash,
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
        proofType: true,
        proofHash: true,
        chainHash: true,
        verified: true,
        anchorStatus: true,
        txId: true,
        blockNumber: true,
        chainProvider: true,
        chainNetwork: true,
        anchoredAt: true,
      },
    });
  }

  private async generateAndPersistTraceRecord(
    productId: number,
    traceCode: string,
    forceRegenerate = false,
  ) {
    const existingByCode = await this.prisma.traceRecord.findUnique({
      where: { traceCode },
      select: {
        id: true,
        proofHash: true,
        chainHash: true,
        anchorStatus: true,
        txId: true,
        blockNumber: true,
        chainProvider: true,
        chainNetwork: true,
        anchoredAt: true,
      },
    });

    if (existingByCode && !forceRegenerate) {
      return this.loadTraceRecordInfoOrThrow(existingByCode.id);
    }

    const aggregate = await this.buildAggregate(productId);

    const batchSnapshot: Prisma.InputJsonValue = {
      ...aggregate.batchInfo,
      plantingDate: aggregate.batchInfo.plantingDate.toISOString(),
      expectedHarvestDate: aggregate.batchInfo.expectedHarvestDate
        ? aggregate.batchInfo.expectedHarvestDate.toISOString()
        : null,
      createdAt: aggregate.batchInfo.createdAt.toISOString(),
    };
    const logsSnapshot: Prisma.InputJsonValue = aggregate.logTimeline.map((item) => ({
      ...item,
      operationDate: item.operationDate.toISOString(),
    }));
    const inspectionsSnapshot: Prisma.InputJsonValue = aggregate.diseaseRecords.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    }));

    const proofSnapshot = this.buildProofSnapshot({
      traceCode,
      productId,
      batchSnapshot,
      logsSnapshot,
      inspectionsSnapshot,
    });
    const generatedProof = await this.traceProofProvider.generateProof(proofSnapshot);
    const chainHash = generatedProof.proofHash;
    const generatedAt = new Date();
    const anchorInput: TraceAnchorInput = {
      traceCode,
      proofHash: generatedProof.proofHash,
      snapshotVersion: TRACE_PROOF_SNAPSHOT_VERSION,
      generatedAt,
    };
    const existingAnchorStatus = this.normalizeAnchorStatus(existingByCode?.anchorStatus);
    const existingProofHash = existingByCode
      ? this.resolveProofHash(existingByCode.proofHash, existingByCode.chainHash)
      : null;
    const existingSuccessfulAnchor =
      existingByCode &&
      existingAnchorStatus === TRACE_ANCHOR_STATUS.SUCCESS &&
      existingProofHash === generatedProof.proofHash
        ? {
            anchorStatus: existingAnchorStatus,
            txId: existingByCode.txId,
            blockNumber: existingByCode.blockNumber,
            chainProvider: existingByCode.chainProvider,
            chainNetwork: existingByCode.chainNetwork,
            anchoredAt: existingByCode.anchoredAt,
          }
        : null;

    const proofWriteData = {
      proofType: generatedProof.proofType,
      proofHash: generatedProof.proofHash,
      snapshotVersion: TRACE_PROOF_SNAPSHOT_VERSION,
      generatedAt,
      verified: true,
      verifiedAt: generatedAt,
      verifyMessage: TRACE_VERIFY_MESSAGE.GENERATED,
      anchorStatus: existingSuccessfulAnchor?.anchorStatus ?? TRACE_ANCHOR_STATUS.NOT_ANCHORED,
      txId: existingSuccessfulAnchor?.txId ?? null,
      blockNumber: existingSuccessfulAnchor?.blockNumber ?? null,
      chainProvider: existingSuccessfulAnchor?.chainProvider ?? null,
      chainNetwork: existingSuccessfulAnchor?.chainNetwork ?? null,
      anchoredAt: existingSuccessfulAnchor?.anchoredAt ?? null,
    } as const;
    let traceRecordId: number | null = null;

    if (existingByCode && forceRegenerate) {
      const updated = await this.prisma.traceRecord.update({
        where: { id: existingByCode.id },
        data: {
          productId,
          traceCode,
          batchSnapshot,
          logsSnapshot,
          inspectionsSnapshot,
          chainHash,
          ...proofWriteData,
        },
        select: { id: true },
      });
      traceRecordId = updated.id;
    }

    if (!existingByCode) {
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
            ...proofWriteData,
          },
          select: { id: true },
        });
        traceRecordId = updated.id;
      } else {
        const created = await this.prisma.traceRecord.create({
          data: {
            productId,
            traceCode,
            batchSnapshot,
            logsSnapshot,
            inspectionsSnapshot,
            chainHash,
            ...proofWriteData,
          },
          select: { id: true },
        });
        traceRecordId = created.id;
      }
    }

    if (traceRecordId === null) {
      throw new BusinessException(ErrorCode.OPERATION_FAILED, 'trace record create/update failed');
    }

    // Local hash proof is the primary path; EVM anchoring is a non-blocking enhancement.
    if (existingSuccessfulAnchor) {
      this.logger.log(
        `Trace anchor skipped traceCode=${traceCode}, anchorStatus=${TRACE_ANCHOR_STATUS.SUCCESS}, reason=already_anchored_locally`,
      );
    } else {
      await this.enhanceTraceRecordWithAnchor(traceRecordId, anchorInput);
    }
    return this.loadTraceRecordInfoOrThrow(traceRecordId);
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
      throw new BusinessException(ErrorCode.NOT_FOUND, 'product not found');
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
      throw new BusinessException(ErrorCode.NOT_FOUND, 'batch not found');
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

  private buildProofSnapshot(input: TraceProofSnapshot): TraceProofSnapshot {
    return input;
  }

  private async loadTraceRecordInfoOrThrow(traceRecordId: number): Promise<TraceRecordInfo> {
    const record = await this.prisma.traceRecord.findUnique({
      where: { id: traceRecordId },
      select: TRACE_RECORD_INFO_SELECT,
    });
    if (!record) {
      throw new BusinessException(ErrorCode.OPERATION_FAILED, 'trace record query failed');
    }
    return record;
  }

  private async enhanceTraceRecordWithAnchor(
    traceRecordId: number,
    anchorInput: TraceAnchorInput,
  ): Promise<void> {
    if (!this.shouldRunEvmAnchorEnhancement()) {
      return;
    }

    try {
      const anchorResult = await this.traceAnchorProvider.anchorProof(anchorInput);
      const anchorStatus = this.normalizeAnchorStatus(anchorResult.anchorStatus);
      const txId = anchorResult.txId ?? null;
      const blockNumber =
        anchorResult.blockNumber === undefined || anchorResult.blockNumber === null
          ? null
          : String(anchorResult.blockNumber);
      const chainProvider =
        anchorResult.chainProvider ||
        this.traceAnchorProvider.providerKey ||
        this.configService.get<string>('trace.chainProvider') ||
        null;
      const chainNetwork =
        anchorResult.chainNetwork ||
        this.configService.get<string>('trace.chainNetwork') ||
        null;
      const anchoredAt =
        anchorResult.anchoredAt ??
        (anchorStatus === TRACE_ANCHOR_STATUS.SUCCESS ? new Date() : null);

      await this.prisma.traceRecord.update({
        where: { id: traceRecordId },
        data: {
          anchorStatus,
          txId,
          blockNumber,
          chainProvider,
          chainNetwork,
          anchoredAt,
        },
      });

      if (anchorStatus === TRACE_ANCHOR_STATUS.SUCCESS) {
        this.logger.log(
          `Trace anchor success traceCode=${anchorInput.traceCode}, proofHash=${this.maskHash(anchorInput.proofHash)}, txId=${txId ?? 'n/a'}, anchorStatus=${anchorStatus}, chainNetwork=${chainNetwork ?? 'n/a'}`,
        );
      } else {
        const reason = this.toSafeErrorMessage(anchorResult.errorMessage || 'anchor_failed');
        this.logger.warn(
          `Trace anchor failed traceCode=${anchorInput.traceCode}, anchorStatus=${anchorStatus}, reason=${reason}`,
        );
      }
    } catch (error) {
      const reason = this.toSafeErrorMessage(error);
      await this.prisma.traceRecord.update({
        where: { id: traceRecordId },
        data: {
          anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
          txId: null,
          blockNumber: null,
          chainProvider:
            this.traceAnchorProvider.providerKey ||
            this.configService.get<string>('trace.chainProvider') ||
            null,
          chainNetwork: this.configService.get<string>('trace.chainNetwork') || null,
          anchoredAt: null,
        },
      });

      this.logger.warn(
        `Trace anchor failed traceCode=${anchorInput.traceCode}, anchorStatus=${TRACE_ANCHOR_STATUS.FAILED}, reason=${reason}`,
      );
    }
  }

  private shouldRunEvmAnchorEnhancement() {
    const anchorEnabled = this.configService.get<boolean>('trace.anchorEnabled', false);
    if (!anchorEnabled) {
      return false;
    }
    const provider =
      this.configService.get<string>('trace.anchorProvider')?.toLowerCase() || 'hash';
    return provider === 'evm';
  }

  private resolveProofHash(
    proofHash: string | null,
    chainHash: string | null,
  ): string | null {
    return proofHash || chainHash || null;
  }

  private isLegacyPlaceholderHashMismatch(
    record: {
      traceCode: string;
      productId: number;
      batchSnapshot: Prisma.JsonValue | null;
      logsSnapshot: Prisma.JsonValue | null;
      inspectionsSnapshot: Prisma.JsonValue | null;
    },
    storedProofHash: string | null,
  ): boolean {
    if (!storedProofHash) {
      return false;
    }

    const batchId = this.extractBatchIdFromSnapshot(record.batchSnapshot);
    if (batchId === null) {
      return false;
    }

    const placeholderPayload = {
      traceCode: record.traceCode,
      productId: record.productId,
      batchSnapshot: { batchId },
      logsSnapshot: [],
      inspectionsSnapshot: [],
    };
    const placeholderHash = createContentHash(placeholderPayload);
    if (placeholderHash !== storedProofHash) {
      return false;
    }

    const logsEmpty = this.isEmptyArrayJson(record.logsSnapshot);
    const inspectionsEmpty = this.isEmptyArrayJson(record.inspectionsSnapshot);
    const batchOnlyId = this.isBatchSnapshotOnlyBatchId(record.batchSnapshot);

    // Only treat as mismatch when placeholder hash is found but snapshot is not placeholder shape.
    return !(logsEmpty && inspectionsEmpty && batchOnlyId);
  }

  private extractBatchIdFromSnapshot(snapshot: Prisma.JsonValue | null): number | null {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return null;
    }
    const raw = (snapshot as Record<string, unknown>).batchId;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return null;
    }
    return value;
  }

  private isEmptyArrayJson(value: Prisma.JsonValue | null): boolean {
    return Array.isArray(value) && value.length === 0;
  }

  private isBatchSnapshotOnlyBatchId(value: Prisma.JsonValue | null): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue);
    if (keys.length !== 1 || keys[0] !== 'batchId') {
      return false;
    }
    return Number.isFinite(Number(objectValue.batchId));
  }

  private normalizeAnchorStatus(status: string | null | undefined): TraceAnchorStatus {
    if (status === TRACE_ANCHOR_STATUS.PENDING) {
      return TRACE_ANCHOR_STATUS.PENDING;
    }
    if (status === TRACE_ANCHOR_STATUS.SUCCESS) {
      return TRACE_ANCHOR_STATUS.SUCCESS;
    }
    if (status === TRACE_ANCHOR_STATUS.FAILED) {
      return TRACE_ANCHOR_STATUS.FAILED;
    }
    return TRACE_ANCHOR_STATUS.NOT_ANCHORED;
  }

  private maskHash(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    if (value.length <= 16) {
      return value;
    }
    return `${value.slice(0, 10)}...${value.slice(-6)}`;
  }

  private toSafeErrorMessage(error: unknown): string {
    const sanitize = (message: string) => {
      return message
        .replace(/0x[a-fA-F0-9]{64}/g, '0x***')
        .replace(
          /(api[_-]?key|private[_-]?key|token|password)\s*[:=]\s*([^\s,;]+)/gi,
          '$1=***',
        );
    };

    if (error instanceof Error) {
      return sanitize(error.message || 'unknown_error');
    }
    return sanitize(String(error));
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



