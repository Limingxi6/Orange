import type { ConfigService } from '@nestjs/config';
import { TRACE_ANCHOR_STATUS } from '../trace.constants';
import { NotaryAnchorProvider } from './notary-anchor.provider';

describe('NotaryAnchorProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  function createProvider(config: Record<string, unknown>) {
    const configService = {
      get: (key: string) => config[key],
    } as unknown as ConfigService;
    return new NotaryAnchorProvider(configService);
  }

  it('anchors proof and maps tx fields when notary succeeds', async () => {
    const provider = createProvider({
      'trace.notaryBaseUrl': 'https://notary.example.com',
      'trace.notaryAnchorPath': '/v1/anchors',
      'trace.chainProvider': 'notary',
      'trace.chainNetwork': 'testnet',
      'trace.anchorTimeoutMs': 8000,
      'trace.notaryApiKey': 'test-key',
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: {
            status: 'success',
            txId: '0xabc123',
            blockNumber: '128',
            anchoredAt: '2026-04-21T09:30:00.000Z',
          },
        }),
    } as never);

    const result = await provider.anchorProof({
      traceCode: 'P1-B1001-KS8Q1A',
      proofHash: 'a'.repeat(64),
      snapshotVersion: 1,
      generatedAt: new Date('2026-04-21T09:30:00.000Z'),
    });

    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.SUCCESS);
    expect(result.txId).toBe('0xabc123');
    expect(result.blockNumber).toBe('128');
    expect(result.chainProvider).toBe('notary');
    expect(result.chainNetwork).toBe('testnet');
    expect(result.anchoredAt).toBeInstanceOf(Date);
  });

  it('returns failed without throwing when notary request fails', async () => {
    const provider = createProvider({
      'trace.notaryBaseUrl': 'https://notary.example.com',
      'trace.chainProvider': 'notary',
      'trace.chainNetwork': 'testnet',
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('connect timeout'));

    const result = await provider.anchorProof({
      traceCode: 'P1-B1001-KS8Q1A',
      proofHash: 'b'.repeat(64),
      snapshotVersion: 1,
      generatedAt: new Date('2026-04-21T09:30:00.000Z'),
    });

    expect(result.anchorStatus).toBe(TRACE_ANCHOR_STATUS.FAILED);
    expect(result.chainProvider).toBe('notary');
    expect(result.chainNetwork).toBe('testnet');
  });
});
