import type { TraceProofType } from '../trace.constants';

export const TRACE_PROOF_PROVIDER_KEY = {
  HASH: 'hash',
} as const;

export type TraceProofProviderKey =
  (typeof TRACE_PROOF_PROVIDER_KEY)[keyof typeof TRACE_PROOF_PROVIDER_KEY];

export type TraceProofSnapshot = {
  traceCode: string;
  productId: number;
  batchSnapshot: unknown;
  logsSnapshot: unknown;
  inspectionsSnapshot: unknown;
};

export type TraceGeneratedProof = {
  proofType: TraceProofType;
  proofHash: string;
};

export type TraceProofVerifyResult = {
  verified: boolean;
  generatedProofHash: string;
  storedProofHash: string | null;
};

export interface TraceProofProvider {
  readonly providerKey: TraceProofProviderKey;
  readonly proofType: TraceProofType;
  generateProof(snapshot: TraceProofSnapshot): Promise<TraceGeneratedProof>;
  verifyProof(
    snapshot: TraceProofSnapshot,
    storedProofHash: string | null,
  ): Promise<TraceProofVerifyResult>;
}

export const TRACE_PROOF_PROVIDER = 'TRACE_PROOF_PROVIDER';
