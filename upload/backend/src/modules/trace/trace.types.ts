import type {
  TraceAnchorStatus,
  TraceProofType,
  TraceVerifyStatus,
} from './trace.constants';

export interface TraceVerifyData {
  traceCode: string;
  exists: boolean;
  verified: boolean;
  status: TraceVerifyStatus;
  message: string;
  proofType: TraceProofType;
  proofHash: string | null;
  anchorStatus: TraceAnchorStatus;
  txId: string | null;
  blockNumber: string | null;
  chainProvider: string | null;
  chainNetwork: string | null;
  anchoredAt: Date | null;
  // backward compatibility
  chainHash: string | null;
}
