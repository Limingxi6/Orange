import { Injectable } from '@nestjs/common';
import {
  TRACE_ANCHOR_PROVIDER_KEY,
  TRACE_ANCHOR_STATUS,
  TRACE_PROOF_TYPE,
} from '../trace.constants';
import { createContentHash } from '../utils/hash.util';
import {
  TRACE_PROOF_PROVIDER_KEY,
  type TraceGeneratedProof,
  type TraceProofProvider,
  type TraceProofSnapshot,
  type TraceProofVerifyResult,
} from '../interfaces/trace-proof-provider.interface';
import type { TraceAnchorProvider } from '../interfaces/trace-anchor-provider.interface';
import type {
  TraceAnchorInput,
  TraceAnchorResult,
  TraceAnchorStatusResult,
} from '../interfaces/trace-anchor-result.interface';

@Injectable()
export class HashProofProvider implements TraceProofProvider, TraceAnchorProvider {
  readonly providerKey = TRACE_PROOF_PROVIDER_KEY.HASH;
  readonly proofType = TRACE_PROOF_TYPE.HASH;

  async generateProof(snapshot: TraceProofSnapshot): Promise<TraceGeneratedProof> {
    return {
      proofType: this.proofType,
      proofHash: createContentHash(snapshot),
    };
  }

  async verifyProof(
    snapshot: TraceProofSnapshot,
    storedProofHash: string | null,
  ): Promise<TraceProofVerifyResult> {
    const generated = await this.generateProof(snapshot);
    return {
      verified: generated.proofHash === storedProofHash,
      generatedProofHash: generated.proofHash,
      storedProofHash,
    };
  }

  async anchorProof(_input: TraceAnchorInput): Promise<TraceAnchorResult> {
    return {
      success: false,
      anchorStatus: TRACE_ANCHOR_STATUS.NOT_ANCHORED,
      chainProvider: TRACE_ANCHOR_PROVIDER_KEY.HASH,
      chainNetwork: 'local',
      errorMessage: 'not_supported',
    };
  }

  async queryAnchorStatus(_txId: string): Promise<TraceAnchorStatusResult> {
    return {
      anchorStatus: TRACE_ANCHOR_STATUS.NOT_ANCHORED,
      message: 'not_supported',
    };
  }
}
