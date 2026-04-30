import type { ConfigService } from '@nestjs/config';
import { HashProofProvider } from './providers/hash-proof.provider';
import { TraceService } from './trace.service';
import {
  TRACE_ANCHOR_STATUS,
  TRACE_PROOF_TYPE,
  TRACE_VERIFY_STATUS,
} from './trace.constants';
import type { TraceAnchorProvider } from './interfaces/trace-anchor-provider.interface';

const FIXED_NOW = new Date('2026-04-21T09:30:00.000Z');

type TraceRecordMock = {
  id: number;
  productId: number;
  traceCode: string;
  proofType: string;
  proofHash: string;
  snapshotVersion: number;
  chainHash: string;
  verified: boolean;
  verifiedAt: Date | null;
  verifyMessage: string;
  generatedAt: Date;
  anchorStatus: string;
  txId: string | null;
  blockNumber: string | null;
  chainProvider: string | null;
  chainNetwork: string | null;
  anchoredAt: Date | null;
  createdAt: Date;
};

describe('TraceService anchor flow', () => {
  function pickSelected<T extends Record<string, unknown>>(
    row: T,
    select?: Record<string, boolean>,
  ): Partial<T> {
    if (!select) {
      return row;
    }
    const picked: Partial<T> = {};
    for (const key of Object.keys(select)) {
      if (select[key]) {
        picked[key as keyof T] = row[key as keyof T];
      }
    }
    return picked;
  }

  function createBasePrismaForCreate() {
    const product = {
      id: 1,
      batchId: 1001,
      productName: 'test orange box',
      grade: 'A',
      weight: 5,
      unit: 'kg',
      packageType: 'box',
      price: '68',
      qrCodeUrl: 'https://trace.orange.local/products/1',
      status: 'listed',
      createdAt: FIXED_NOW,
    };

    const batch = {
      id: 1001,
      batchNo: 'B1001',
      orchardName: 'Orchard-3',
      variety: 'Navel',
      area: '5mu',
      plantingDate: FIXED_NOW,
      expectedHarvestDate: FIXED_NOW,
      stage: 'mature',
      status: 'growing',
      managerId: 99,
      createdAt: FIXED_NOW,
    };

    let storedRecord: TraceRecordMock | null = null;

    const findUnique = jest.fn().mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if ('traceCode' in args.where) {
        if (!storedRecord || storedRecord.traceCode !== args.where.traceCode) {
          return null;
        }
        return pickSelected(storedRecord, (args as { select?: Record<string, boolean> }).select);
      }

      if ('id' in args.where) {
        if (!storedRecord || storedRecord.id !== args.where.id) {
          return null;
        }
        return pickSelected(storedRecord, (args as { select?: Record<string, boolean> }).select);
      }
      return null;
    });

    const create = jest.fn().mockImplementation(
      async (args: {
        data: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        storedRecord = {
          id: 101,
          productId: args.data.productId as number,
          traceCode: args.data.traceCode as string,
          proofType: args.data.proofType as string,
          proofHash: args.data.proofHash as string,
          snapshotVersion: args.data.snapshotVersion as number,
          chainHash: args.data.chainHash as string,
          verified: args.data.verified as boolean,
          verifiedAt: (args.data.verifiedAt as Date) ?? null,
          verifyMessage: args.data.verifyMessage as string,
          generatedAt: args.data.generatedAt as Date,
          anchorStatus: args.data.anchorStatus as string,
          txId: (args.data.txId as string | null) ?? null,
          blockNumber: (args.data.blockNumber as string | null) ?? null,
          chainProvider: (args.data.chainProvider as string | null) ?? null,
          chainNetwork: (args.data.chainNetwork as string | null) ?? null,
          anchoredAt: (args.data.anchoredAt as Date | null) ?? null,
          createdAt: FIXED_NOW,
        };
        return pickSelected(storedRecord, args.select);
      },
    );

    const update = jest.fn().mockImplementation(
      async (args: {
        where: { id: number };
        data: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        if (!storedRecord || storedRecord.id !== args.where.id) {
          throw new Error('record_not_found');
        }
        storedRecord = {
          ...storedRecord,
          ...args.data,
        } as TraceRecordMock;
        return pickSelected(storedRecord, args.select);
      },
    );

    return {
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
      },
      batch: {
        findUnique: jest.fn().mockResolvedValue(batch),
      },
      farmingLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      diseaseRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      traceRecord: {
        findUnique,
        findFirst: jest.fn().mockResolvedValue(null),
        create,
        update,
      },
      getStoredRecord: () => storedRecord,
    };
  }

  function createConfigService(values: Record<string, unknown>) {
    return {
      get: (key: string, defaultValue?: unknown) =>
        key in values ? values[key] : defaultValue,
    } as unknown as ConfigService;
  }

  it('writes tx fields in a second-phase update when anchor succeeds', async () => {
    const prisma = createBasePrismaForCreate();
    const proofProvider = new HashProofProvider();
    const anchorProvider: TraceAnchorProvider = {
      providerKey: 'evm',
      anchorProof: jest.fn().mockResolvedValue({
        success: true,
        txId: '0xabc123',
        blockNumber: '128',
        anchorStatus: TRACE_ANCHOR_STATUS.SUCCESS,
        chainProvider: 'evm',
        chainNetwork: 'sepolia',
        anchoredAt: FIXED_NOW,
      }),
    };

    const service = new TraceService(
      prisma as never,
      { suggestTraceAdvice: jest.fn().mockResolvedValue({ content: { title: '溯源说明建议', summary: '', actions: [] }, fromLlm: false }) } as never,
      createConfigService({
        'trace.anchorEnabled': true,
        'trace.anchorProvider': 'evm',
      }),
      proofProvider,
      anchorProvider,
    );

    const result = await service.createOrUpdateForProduct(1, 'P1-B1001-KS8Q1A');

    const createCall = prisma.traceRecord.create.mock.calls[0][0].data;
    expect(createCall.anchorStatus).toBe(TRACE_ANCHOR_STATUS.NOT_ANCHORED);
    expect(createCall.txId).toBeNull();

    const anchorUpdateCall = prisma.traceRecord.update.mock.calls[0][0].data;
    expect(anchorUpdateCall.anchorStatus).toBe(TRACE_ANCHOR_STATUS.SUCCESS);
    expect(anchorUpdateCall.txId).toBe('0xabc123');
    expect(anchorUpdateCall.chainProvider).toBe('evm');
    expect(anchorUpdateCall.chainNetwork).toBe('sepolia');

    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.SUCCESS);
  });

  it('skips evm anchor retry when an existing trace code is already anchored', async () => {
    const prisma = createBasePrismaForCreate();
    const proofProvider = new HashProofProvider();
    const anchorProvider: TraceAnchorProvider = {
      providerKey: 'evm',
      anchorProof: jest.fn().mockResolvedValue({
        success: true,
        txId: '0xabc123',
        blockNumber: '128',
        anchorStatus: TRACE_ANCHOR_STATUS.SUCCESS,
        chainProvider: 'evm',
        chainNetwork: 'sepolia',
        anchoredAt: FIXED_NOW,
      }),
    };

    const service = new TraceService(
      prisma as never,
      { suggestTraceAdvice: jest.fn().mockResolvedValue({ content: { title: '溯源说明建议', summary: '', actions: [] }, fromLlm: false }) } as never,
      createConfigService({
        'trace.anchorEnabled': true,
        'trace.anchorProvider': 'evm',
      }),
      proofProvider,
      anchorProvider,
    );

    await service.createOrUpdateForProduct(1, 'P1-B1001-KS8Q1A');
    const result = await service.createOrUpdateForProduct(1, 'P1-B1001-KS8Q1A');

    expect(anchorProvider.anchorProof).toHaveBeenCalledTimes(1);

    const regenerateUpdateCall = prisma.traceRecord.update.mock.calls[1][0].data;
    expect(regenerateUpdateCall.anchorStatus).toBe(TRACE_ANCHOR_STATUS.SUCCESS);
    expect(regenerateUpdateCall.txId).toBe('0xabc123');
    expect(regenerateUpdateCall.chainProvider).toBe('evm');
    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.SUCCESS);
  });

  it('keeps main flow when anchor fails', async () => {
    const prisma = createBasePrismaForCreate();
    const proofProvider = new HashProofProvider();
    const anchorProvider: TraceAnchorProvider = {
      providerKey: 'evm',
      anchorProof: jest.fn().mockRejectedValue(new Error('rpc timeout')),
    };

    const service = new TraceService(
      prisma as never,
      { suggestTraceAdvice: jest.fn().mockResolvedValue({ content: { title: '溯源说明建议', summary: '', actions: [] }, fromLlm: false }) } as never,
      createConfigService({
        'trace.anchorEnabled': true,
        'trace.anchorProvider': 'evm',
        'trace.chainProvider': 'evm',
        'trace.chainNetwork': 'sepolia',
      }),
      proofProvider,
      anchorProvider,
    );

    const result = await service.createOrUpdateForProduct(1, 'P1-B1001-KS8Q1A');

    const createCall = prisma.traceRecord.create.mock.calls[0][0].data;
    expect(createCall.anchorStatus).toBe(TRACE_ANCHOR_STATUS.NOT_ANCHORED);

    const anchorUpdateCall = prisma.traceRecord.update.mock.calls[0][0].data;
    expect(anchorUpdateCall.anchorStatus).toBe(TRACE_ANCHOR_STATUS.FAILED);
    expect(anchorUpdateCall.txId).toBeNull();
    expect(anchorUpdateCall.chainProvider).toBe('evm');
    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.FAILED);
  });

  it('stays in local mode when TRACE_ANCHOR_ENABLED=false', async () => {
    const prisma = createBasePrismaForCreate();
    const proofProvider = new HashProofProvider();
    const anchorProvider: TraceAnchorProvider = {
      providerKey: 'evm',
      anchorProof: jest.fn().mockResolvedValue({
        success: false,
        anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
        chainProvider: 'evm',
        chainNetwork: 'sepolia',
      }),
    };

    const service = new TraceService(
      prisma as never,
      { suggestTraceAdvice: jest.fn().mockResolvedValue({ content: { title: '溯源说明建议', summary: '', actions: [] }, fromLlm: false }) } as never,
      createConfigService({
        'trace.anchorEnabled': false,
      }),
      proofProvider,
      anchorProvider,
    );

    await service.createOrUpdateForProduct(1, 'P1-B1001-KS8Q1A');

    expect(anchorProvider.anchorProof).not.toHaveBeenCalled();
    const createCall = prisma.traceRecord.create.mock.calls[0][0].data;
    expect(createCall.proofType).toBe(TRACE_PROOF_TYPE.HASH);
    expect(createCall.anchorStatus).toBe(TRACE_ANCHOR_STATUS.NOT_ANCHORED);
    expect(prisma.traceRecord.update).not.toHaveBeenCalled();
  });

  it('verify keeps local hash result as primary even when anchorStatus is failed', async () => {
    const proofProvider = new HashProofProvider();
    const traceCode = 'P1-B1001-KS8Q1A';
    const snapshot = {
      traceCode,
      productId: 1,
      batchSnapshot: { batchNo: 'B1001' },
      logsSnapshot: [],
      inspectionsSnapshot: [],
    };
    const generated = await proofProvider.generateProof(snapshot);

    const prisma = {
      traceRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 100,
          productId: 1,
          traceCode,
          batchSnapshot: snapshot.batchSnapshot,
          logsSnapshot: snapshot.logsSnapshot,
          inspectionsSnapshot: snapshot.inspectionsSnapshot,
          proofType: TRACE_PROOF_TYPE.HASH,
          proofHash: generated.proofHash,
          chainHash: generated.proofHash,
          verified: false,
          anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
          txId: null,
          blockNumber: null,
          chainProvider: 'evm',
          chainNetwork: 'sepolia',
          anchoredAt: null,
        }),
        update: jest.fn(),
      },
    };

    const service = new TraceService(
      prisma as never,
      { suggestTraceAdvice: jest.fn().mockResolvedValue({ content: { title: '溯源说明建议', summary: '', actions: [] }, fromLlm: false }) } as never,
      createConfigService({
        'trace.anchorEnabled': false,
      }),
      proofProvider,
      {
        providerKey: 'evm',
        anchorProof: jest.fn().mockResolvedValue({
          success: false,
          anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
          chainProvider: 'evm',
          chainNetwork: 'sepolia',
        }),
      },
    );

    const result = await service.verifyChain(traceCode);

    expect(result.verified).toBe(true);
    expect(result.status).toBe(TRACE_VERIFY_STATUS.VERIFIED);
    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.FAILED);
    expect(result.chainProvider).toBe('evm');
  });
});

