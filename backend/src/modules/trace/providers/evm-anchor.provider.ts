import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  isAddress,
  type InterfaceAbi,
} from 'ethers';
import {
  TRACE_ANCHOR_PROVIDER_KEY,
  TRACE_ANCHOR_STATUS,
} from '../trace.constants';
import type { TraceAnchorProvider } from '../interfaces/trace-anchor-provider.interface';
import type {
  TraceAnchorInput,
  TraceAnchorResult,
  TraceAnchorStatusResult,
} from '../interfaces/trace-anchor-result.interface';

type TraceAnchorArtifact = {
  abi: InterfaceAbi;
};

@Injectable()
export class EvmAnchorProvider implements TraceAnchorProvider {
  readonly providerKey = TRACE_ANCHOR_PROVIDER_KEY.EVM;

  private readonly logger = new Logger(EvmAnchorProvider.name);
  private readonly anchorEnabled: boolean;
  private readonly anchorProvider: string;
  private readonly chainNetwork: string;

  private provider: JsonRpcProvider | null = null;
  private contract: Contract | null = null;
  private initError: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.anchorEnabled = this.configService.get<boolean>('trace.anchorEnabled', false);
    this.anchorProvider =
      this.configService.get<string>('trace.anchorProvider')?.toLowerCase() || 'hash';
    this.chainNetwork =
      this.configService.get<string>('trace.evm.chainName') ||
      this.configService.get<string>('trace.chainNetwork') ||
      'sepolia';

    if (!this.anchorEnabled || this.anchorProvider !== this.providerKey) {
      this.initError = 'evm_anchor_disabled';
      return;
    }

    this.initializeOrThrow();
  }

  async anchorProof(input: TraceAnchorInput): Promise<TraceAnchorResult> {
    if (!this.contract) {
      return this.buildFailedResult(this.initError || 'evm_provider_not_ready');
    }

    try {
      const tx = await this.contract.anchorTrace(input.traceCode, input.proofHash);
      const receipt = await tx.wait();
      const txId = typeof tx.hash === 'string' ? tx.hash : undefined;
      const isSuccess = receipt?.status === 1;
      const blockNumber =
        typeof receipt?.blockNumber === 'number'
          ? String(receipt.blockNumber)
          : undefined;

      if (isSuccess) {
        this.logger.log(
          `EVM anchor success traceCode=${input.traceCode}, proofHash=${this.maskHash(input.proofHash)}, txId=${txId ?? 'n/a'}, anchorStatus=${TRACE_ANCHOR_STATUS.SUCCESS}, chainNetwork=${this.chainNetwork}`,
        );

        return {
          success: true,
          txId,
          blockNumber,
          anchorStatus: TRACE_ANCHOR_STATUS.SUCCESS,
          chainProvider: this.providerKey,
          chainNetwork: this.chainNetwork,
          anchoredAt: new Date(),
        };
      }

      this.logger.warn(
        `EVM anchor failed traceCode=${input.traceCode}, proofHash=${this.maskHash(input.proofHash)}, anchorStatus=${TRACE_ANCHOR_STATUS.FAILED}, reason=tx_reverted`,
      );
      return this.buildFailedResult('tx_reverted');
    } catch (error) {
      const reason = this.toSafeErrorMessage(error);
      if (this.isAlreadyAnchoredRevert(reason)) {
        return this.resolveAlreadyAnchoredResult(input, reason);
      }
      this.logger.warn(
        `EVM anchor failed traceCode=${input.traceCode}, proofHash=${this.maskHash(input.proofHash)}, anchorStatus=${TRACE_ANCHOR_STATUS.FAILED}, reason=${reason}`,
      );
      return this.buildFailedResult(reason);
    }
  }

  async queryAnchorStatus(txId: string): Promise<TraceAnchorStatusResult> {
    if (!this.provider) {
      return {
        anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
        txId,
        message: 'evm_provider_not_ready',
      };
    }

    try {
      const receipt = await this.provider.getTransactionReceipt(txId);
      if (!receipt) {
        return {
          anchorStatus: TRACE_ANCHOR_STATUS.PENDING,
          txId,
          message: 'pending_confirmation',
        };
      }

      if (receipt.status === 1) {
        return {
          anchorStatus: TRACE_ANCHOR_STATUS.SUCCESS,
          txId,
          blockNumber: String(receipt.blockNumber),
          message: 'confirmed',
        };
      }

      return {
        anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
        txId,
        blockNumber: String(receipt.blockNumber),
        message: 'tx_reverted',
      };
    } catch (error) {
      return {
        anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
        txId,
        message: this.toSafeErrorMessage(error),
      };
    }
  }

  private initializeOrThrow() {
    const rpcUrl = this.configService.get<string>('trace.evm.rpcUrl');
    const privateKey = this.configService.get<string>('trace.evm.privateKey');
    const chainId = this.configService.get<number>('trace.evm.chainId');
    const contractAddress = this.configService.get<string>('trace.evm.contractAddress');

    if (!rpcUrl || !privateKey || !chainId || !contractAddress) {
      const message = 'EVM anchor init failed: required env missing';
      this.initError = message;
      throw new Error(message);
    }

    if (!Number.isInteger(chainId) || chainId <= 0) {
      const message = 'EVM anchor init failed: EVM_CHAIN_ID invalid';
      this.initError = message;
      throw new Error(message);
    }

    if (!isAddress(contractAddress)) {
      const message = 'EVM anchor init failed: EVM_CONTRACT_ADDRESS invalid';
      this.initError = message;
      throw new Error(message);
    }

    const abi = this.loadTraceAnchorAbi();
    if (!Array.isArray(abi) || abi.length === 0) {
      const message = 'EVM anchor init failed: TraceAnchor ABI invalid';
      this.initError = message;
      throw new Error(message);
    }

    try {
      this.provider = new JsonRpcProvider(rpcUrl, chainId);
      const signer = new Wallet(privateKey, this.provider);
      this.contract = new Contract(contractAddress, abi, signer);
      this.initError = null;
      this.logger.log(`EVM anchor provider initialized, chainNetwork=${this.chainNetwork}`);
    } catch (error) {
      this.provider = null;
      this.contract = null;
      const reason = this.toSafeErrorMessage(error);
      this.initError = `EVM anchor init failed: ${reason}`;
      throw new Error(this.initError);
    }
  }

  private loadTraceAnchorAbi(): InterfaceAbi {
    const candidates = [
      resolve(__dirname, '../contracts/TraceAnchor.json'),
      resolve(process.cwd(), 'src/modules/trace/contracts/TraceAnchor.json'),
      resolve(process.cwd(), 'dist/src/modules/trace/contracts/TraceAnchor.json'),
    ];

    for (const candidate of candidates) {
      if (!existsSync(candidate)) {
        continue;
      }

      try {
        const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as Partial<TraceAnchorArtifact>;
        if (Array.isArray(parsed.abi) && parsed.abi.length > 0) {
          return parsed.abi as InterfaceAbi;
        }
      } catch (error) {
        this.logger.warn(
          `TraceAnchor ABI parse failed path=${candidate}, reason=${this.toSafeErrorMessage(error)}`,
        );
      }
    }

    throw new Error(
      'EVM anchor init failed: TraceAnchor ABI file not found. Expected at src/modules/trace/contracts/TraceAnchor.json or dist equivalent.',
    );
  }

  private buildFailedResult(errorMessage: string): TraceAnchorResult {
    return {
      success: false,
      anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
      chainProvider: this.providerKey,
      chainNetwork: this.chainNetwork,
      errorMessage,
    };
  }

  private async resolveAlreadyAnchoredResult(
    input: TraceAnchorInput,
    originalReason: string,
  ): Promise<TraceAnchorResult> {
    try {
      const anchor = await this.contract?.getAnchor(input.traceCode);
      const anchoredProofHash = this.pickAnchorValue(anchor, 'proofHash', 1);
      const anchoredAt = this.parseAnchorTimestamp(
        this.pickAnchorValue(anchor, 'anchoredAt', 2),
      );

      if (anchoredProofHash !== input.proofHash) {
        const reason = 'trace_already_anchored_with_different_hash';
        this.logger.warn(
          `EVM anchor failed traceCode=${input.traceCode}, proofHash=${this.maskHash(input.proofHash)}, anchorStatus=${TRACE_ANCHOR_STATUS.FAILED}, reason=${reason}`,
        );
        return this.buildFailedResult(reason);
      }

      this.logger.log(
        `EVM anchor idempotent success traceCode=${input.traceCode}, proofHash=${this.maskHash(input.proofHash)}, anchorStatus=${TRACE_ANCHOR_STATUS.SUCCESS}, chainNetwork=${this.chainNetwork}`,
      );

      return {
        success: true,
        anchorStatus: TRACE_ANCHOR_STATUS.SUCCESS,
        chainProvider: this.providerKey,
        chainNetwork: this.chainNetwork,
        anchoredAt,
      };
    } catch (error) {
      const reason = this.toSafeErrorMessage(error || originalReason);
      this.logger.warn(
        `EVM anchor failed traceCode=${input.traceCode}, proofHash=${this.maskHash(input.proofHash)}, anchorStatus=${TRACE_ANCHOR_STATUS.FAILED}, reason=${reason}`,
      );
      return this.buildFailedResult(reason);
    }
  }

  private isAlreadyAnchoredRevert(reason: string): boolean {
    return reason.toLowerCase().includes('trace already anchored');
  }

  private pickAnchorValue(anchor: unknown, key: string, index: number): unknown {
    if (Array.isArray(anchor)) {
      return anchor[index];
    }
    if (anchor && typeof anchor === 'object') {
      const record = anchor as Record<string, unknown>;
      return record[key] ?? record[index];
    }
    return undefined;
  }

  private parseAnchorTimestamp(value: unknown): Date | undefined {
    if (typeof value === 'bigint') {
      const timestamp = Number(value);
      return Number.isSafeInteger(timestamp) && timestamp > 0
        ? new Date(timestamp * 1000)
        : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return new Date(value * 1000);
    }
    if (typeof value === 'string' && value.trim()) {
      const timestamp = Number(value);
      if (Number.isFinite(timestamp) && timestamp > 0) {
        return new Date(timestamp * 1000);
      }
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    return undefined;
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

  private maskHash(value: string): string {
    if (!value || value.length <= 16) {
      return value;
    }
    return `${value.slice(0, 10)}...${value.slice(-6)}`;
  }
}
