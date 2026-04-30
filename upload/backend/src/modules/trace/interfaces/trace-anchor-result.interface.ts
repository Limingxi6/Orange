import type { TraceAnchorProviderKey, TraceAnchorStatus } from '../trace.constants';

export interface TraceAnchorInput {
  traceCode: string;
  proofHash: string;
  snapshotVersion?: number;
  generatedAt?: Date;
}

export interface TraceAnchorResult {
  success: boolean;
  txId?: string;
  blockNumber?: number | string;
  anchorStatus: TraceAnchorStatus;
  chainProvider: TraceAnchorProviderKey | string;
  chainNetwork: string;
  anchoredAt?: Date;
  errorMessage?: string;
}

export interface TraceAnchorStatusResult {
  anchorStatus: TraceAnchorStatus;
  txId?: string;
  blockNumber?: number | string;
  message?: string;
}
