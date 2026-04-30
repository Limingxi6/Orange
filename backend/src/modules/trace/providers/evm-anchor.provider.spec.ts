import type { ConfigService } from '@nestjs/config';
import { TRACE_ANCHOR_STATUS } from '../trace.constants';
import { EvmAnchorProvider } from './evm-anchor.provider';

describe('EvmAnchorProvider', () => {
  function createProvider(config: Record<string, unknown>) {
    const configService = {
      get: (key: string) => config[key],
    } as unknown as ConfigService;
    return new EvmAnchorProvider(configService);
  }

  it('returns failed when evm provider is not initialized', async () => {
    const provider = createProvider({
      'trace.evm.chainName': 'sepolia',
    });

    const result = await provider.anchorProof({
      traceCode: 'P1-B1001-KS8Q1A',
      proofHash: 'a'.repeat(64),
      snapshotVersion: 1,
      generatedAt: new Date('2026-04-21T09:30:00.000Z'),
    });

    expect(result.success).toBe(false);
    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.FAILED);
    expect(result.chainProvider).toBe('evm');
    expect(result.chainNetwork).toBe('sepolia');
  });

  it('throws clear init error when evm mode is enabled but env is incomplete', () => {
    expect(() =>
      createProvider({
        'trace.anchorEnabled': true,
        'trace.anchorProvider': 'evm',
        'trace.evm.chainName': 'sepolia',
      }),
    ).toThrow('required env missing');
  });

  it('anchors successfully when contract call succeeds', async () => {
    const provider = createProvider({
      'trace.evm.chainName': 'sepolia',
    });

    (
      provider as unknown as {
        contract: {
          anchorTrace: jest.Mock;
        };
      }
    ).contract = {
      anchorTrace: jest.fn().mockResolvedValue({
        hash: '0xabc123',
        wait: jest.fn().mockResolvedValue({
          status: 1,
          blockNumber: 128,
        }),
      }),
    };

    const result = await provider.anchorProof({
      traceCode: 'P1-B1001-KS8Q1A',
      proofHash: 'b'.repeat(64),
      snapshotVersion: 1,
      generatedAt: new Date('2026-04-21T09:30:00.000Z'),
    });

    expect(result.success).toBe(true);
    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.SUCCESS);
    expect(result.txId).toBe('0xabc123');
    expect(result.blockNumber).toBe('128');
  });

  it('returns failed when contract call throws', async () => {
    const provider = createProvider({
      'trace.evm.chainName': 'sepolia',
    });

    (
      provider as unknown as {
        contract: {
          anchorTrace: jest.Mock;
        };
      }
    ).contract = {
      anchorTrace: jest
        .fn()
        .mockRejectedValue(
          new Error(
            'rpc timeout private_key=0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          ),
        ),
    };

    const result = await provider.anchorProof({
      traceCode: 'P1-B1001-KS8Q1A',
      proofHash: 'b'.repeat(64),
      snapshotVersion: 1,
      generatedAt: new Date('2026-04-21T09:30:00.000Z'),
    });

    expect(result.success).toBe(false);
    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.FAILED);
    expect(result.errorMessage).not.toContain(
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
  });

  it('treats duplicate anchor as success when chain proof hash matches', async () => {
    const provider = createProvider({
      'trace.evm.chainName': 'sepolia',
    });
    const proofHash = 'c'.repeat(64);

    (
      provider as unknown as {
        contract: {
          anchorTrace: jest.Mock;
          getAnchor: jest.Mock;
        };
      }
    ).contract = {
      anchorTrace: jest
        .fn()
        .mockRejectedValue(new Error('execution reverted: "trace already anchored"')),
      getAnchor: jest.fn().mockResolvedValue(['P1-B1001-KS8Q1A', proofHash, 1776763800n]),
    };

    const result = await provider.anchorProof({
      traceCode: 'P1-B1001-KS8Q1A',
      proofHash,
      snapshotVersion: 1,
      generatedAt: new Date('2026-04-21T09:30:00.000Z'),
    });

    expect(result.success).toBe(true);
    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.SUCCESS);
    expect(result.anchoredAt).toEqual(new Date('2026-04-21T09:30:00.000Z'));
  });

  it('keeps duplicate anchor failed when chain proof hash differs', async () => {
    const provider = createProvider({
      'trace.evm.chainName': 'sepolia',
    });

    (
      provider as unknown as {
        contract: {
          anchorTrace: jest.Mock;
          getAnchor: jest.Mock;
        };
      }
    ).contract = {
      anchorTrace: jest
        .fn()
        .mockRejectedValue(new Error('execution reverted: "trace already anchored"')),
      getAnchor: jest
        .fn()
        .mockResolvedValue(['P1-B1001-KS8Q1A', 'd'.repeat(64), 1776763800n]),
    };

    const result = await provider.anchorProof({
      traceCode: 'P1-B1001-KS8Q1A',
      proofHash: 'c'.repeat(64),
      snapshotVersion: 1,
      generatedAt: new Date('2026-04-21T09:30:00.000Z'),
    });

    expect(result.success).toBe(false);
    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.FAILED);
    expect(result.errorMessage).toBe('trace_already_anchored_with_different_hash');
  });
});
