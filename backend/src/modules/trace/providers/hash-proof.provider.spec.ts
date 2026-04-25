import { TRACE_ANCHOR_STATUS, TRACE_PROOF_TYPE } from '../trace.constants';
import { HashProofProvider } from './hash-proof.provider';

describe('HashProofProvider', () => {
  const provider = new HashProofProvider();

  it('generates deterministic hash with stable serialization', async () => {
    const snapshotA = {
      traceCode: 'P1-B1001-KS8Q1A',
      productId: 1,
      batchSnapshot: {
        orchardName: '东区3号地',
        batchNo: '2026春-纽荷尔脐橙A区',
      },
      logsSnapshot: [{ id: 1, type: 'spray', content: '波尔多液预防性喷施' }],
      inspectionsSnapshot: [{ id: 1, label: '疑似柑橘溃疡病', confidence: 0.91 }],
    };

    const snapshotB = {
      productId: 1,
      traceCode: 'P1-B1001-KS8Q1A',
      batchSnapshot: {
        batchNo: '2026春-纽荷尔脐橙A区',
        orchardName: '东区3号地',
      },
      logsSnapshot: [{ content: '波尔多液预防性喷施', type: 'spray', id: 1 }],
      inspectionsSnapshot: [{ confidence: 0.91, label: '疑似柑橘溃疡病', id: 1 }],
    };

    const proofA = await provider.generateProof(snapshotA);
    const proofB = await provider.generateProof(snapshotB);

    expect(proofA.proofType).toBe(TRACE_PROOF_TYPE.HASH);
    expect(proofA.proofHash).toMatch(/^[a-f0-9]{64}$/);
    expect(proofA.proofHash).toBe(proofB.proofHash);
  });

  it('verifies and rejects tampered snapshots', async () => {
    const snapshot = {
      traceCode: 'P1-B1001-KS8Q1A',
      productId: 1,
      batchSnapshot: { batchNo: '2026春-纽荷尔脐橙A区' },
      logsSnapshot: [],
      inspectionsSnapshot: [],
    };
    const generated = await provider.generateProof(snapshot);

    const verifiedResult = await provider.verifyProof(snapshot, generated.proofHash);
    expect(verifiedResult.verified).toBe(true);

    const tampered = {
      ...snapshot,
      productId: 2,
    };
    const failedResult = await provider.verifyProof(tampered, generated.proofHash);
    expect(failedResult.verified).toBe(false);
    expect(failedResult.storedProofHash).toBe(generated.proofHash);
  });

  it('returns not_supported/not_anchored for anchor methods', async () => {
    const generated = await provider.generateProof({
      traceCode: 'P1-B1001-KS8Q1A',
      productId: 1,
      batchSnapshot: {},
      logsSnapshot: [],
      inspectionsSnapshot: [],
    });

    const anchorResult = await provider.anchorProof({
      traceCode: 'P1-B1001-KS8Q1A',
      proofHash: generated.proofHash,
      snapshotVersion: 1,
      generatedAt: new Date('2026-04-21T09:30:00.000Z'),
    });
    expect(anchorResult.anchorStatus).toBe(TRACE_ANCHOR_STATUS.NOT_ANCHORED);
    expect(anchorResult.errorMessage).toBe('not_supported');

    const statusResult = await provider.queryAnchorStatus('tx-1');
    expect(statusResult.anchorStatus).toBe(TRACE_ANCHOR_STATUS.NOT_ANCHORED);
    expect(statusResult.message).toBe('not_supported');
  });
});
