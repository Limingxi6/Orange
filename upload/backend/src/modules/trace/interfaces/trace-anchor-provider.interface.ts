import type { TraceAnchorProviderKey } from '../trace.constants';
import type {
  TraceAnchorInput,
  TraceAnchorResult,
  TraceAnchorStatusResult,
} from './trace-anchor-result.interface';

export interface TraceAnchorProvider {
  readonly providerKey: TraceAnchorProviderKey;
  anchorProof(input: TraceAnchorInput): Promise<TraceAnchorResult>;
  queryAnchorStatus?(txId: string): Promise<TraceAnchorStatusResult>;
}

export const TRACE_ANCHOR_PROVIDER = 'TRACE_ANCHOR_PROVIDER';
