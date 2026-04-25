import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TRACE_ANCHOR_PROVIDER_KEY,
  TRACE_ANCHOR_STATUS,
  type TraceAnchorStatus,
} from '../trace.constants';
import type { TraceAnchorProvider } from '../interfaces/trace-anchor-provider.interface';
import type {
  TraceAnchorInput,
  TraceAnchorResult,
  TraceAnchorStatusResult,
} from '../interfaces/trace-anchor-result.interface';

type JsonObject = Record<string, unknown>;

@Injectable()
export class NotaryAnchorProvider implements TraceAnchorProvider {
  readonly providerKey = TRACE_ANCHOR_PROVIDER_KEY.NOTARY;

  private readonly logger = new Logger(NotaryAnchorProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async anchorProof(input: TraceAnchorInput): Promise<TraceAnchorResult> {
    const chainProvider = this.resolveChainProvider();
    const chainNetwork = this.resolveChainNetwork();
    const baseUrl = this.configService.get<string>('trace.notaryBaseUrl');
    const anchorPath =
      this.configService.get<string>('trace.notaryAnchorPath') || '/v1/anchors';

    if (!baseUrl) {
      this.logger.warn('TRACE_NOTARY_BASE_URL is empty; anchor request skipped');
      return {
        success: false,
        anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
        chainProvider,
        chainNetwork,
        errorMessage: 'notary_base_url_missing',
      };
    }

    const endpoint = this.buildEndpoint(baseUrl, anchorPath);
    const headers = this.buildHeaders();

    try {
      const response = await this.requestJson(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          traceCode: input.traceCode,
          proofHash: input.proofHash,
          snapshotVersion: input.snapshotVersion ?? 1,
          generatedAt: (input.generatedAt ?? new Date()).toISOString(),
        }),
      });

      const data = this.unwrapData(response);
      const txId = this.pickString(data, [
        'txId',
        'tx_id',
        'transactionId',
        'transaction_id',
        'hash',
      ]);

      const statusInput =
        this.pickValue(data, ['status', 'anchorStatus', 'anchor_status']) ??
        this.pickValue(response, ['status']);
      const normalizedStatus = this.normalizeAnchorStatus(statusInput);
      const anchorStatus =
        normalizedStatus === TRACE_ANCHOR_STATUS.NOT_ANCHORED && txId
          ? TRACE_ANCHOR_STATUS.PENDING
          : normalizedStatus;

      return {
        success: anchorStatus === TRACE_ANCHOR_STATUS.SUCCESS,
        txId: txId ?? undefined,
        blockNumber:
          this.pickString(data, ['blockNumber', 'block_number']) ?? undefined,
        anchorStatus,
        chainProvider:
          this.pickString(data, ['chainProvider', 'provider']) || chainProvider,
        chainNetwork:
          this.pickString(data, ['chainNetwork', 'network']) || chainNetwork,
        anchoredAt: this.parseDate(
          this.pickValue(data, ['anchoredAt', 'anchored_at', 'confirmedAt']),
        ) ?? undefined,
        errorMessage: this.pickString(data, ['message']) ?? undefined,
      };
    } catch (error) {
      this.logger.warn(
        `Notary anchor failed traceCode=${input.traceCode}, proofHash=${input.proofHash}, reason=${this.toSafeErrorMessage(error)}`,
      );

      return {
        success: false,
        anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
        chainProvider,
        chainNetwork,
        errorMessage: 'anchor_request_failed',
      };
    }
  }

  async queryAnchorStatus(txId: string): Promise<TraceAnchorStatusResult> {
    const baseUrl = this.configService.get<string>('trace.notaryBaseUrl');
    const statusPathTemplate =
      this.configService.get<string>('trace.notaryStatusPath') ||
      '/v1/anchors/{id}';

    if (!baseUrl) {
      return {
        anchorStatus: TRACE_ANCHOR_STATUS.NOT_ANCHORED,
        message: 'notary_base_url_missing',
      };
    }

    const statusPath = statusPathTemplate.includes('{id}')
      ? statusPathTemplate.replace('{id}', encodeURIComponent(txId))
      : `${statusPathTemplate.replace(/\/$/, '')}/${encodeURIComponent(txId)}`;
    const endpoint = this.buildEndpoint(baseUrl, statusPath);

    try {
      const response = await this.requestJson(endpoint, {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      const data = this.unwrapData(response);

      return {
        anchorStatus: this.normalizeAnchorStatus(
          this.pickValue(data, ['status', 'anchorStatus', 'anchor_status']) ??
            this.pickValue(response, ['status']),
        ),
        message: this.pickString(data, ['message']) ?? undefined,
        txId: this.pickString(data, ['txId', 'tx_id', 'transactionId']) || txId,
        blockNumber:
          this.pickString(data, ['blockNumber', 'block_number']) ?? undefined,
      };
    } catch (error) {
      this.logger.warn(
        `Notary anchor status query failed txId=${txId}, reason=${this.toSafeErrorMessage(error)}`,
      );
      return {
        anchorStatus: TRACE_ANCHOR_STATUS.FAILED,
        message: 'status_query_failed',
        txId,
      };
    }
  }

  private buildEndpoint(baseUrl: string, path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    return new URL(normalizedPath, normalizedBase).toString();
  }

  private buildHeaders(): Record<string, string> {
    const apiKey = this.configService.get<string>('trace.notaryApiKey');
    return {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey } : {}),
    };
  }

  private async requestJson(endpoint: string, request: RequestInit): Promise<JsonObject> {
    const timeoutMs = this.resolveTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        ...request,
        signal: controller.signal,
      });
      const text = await response.text().catch(() => '');

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      if (!text) {
        return {};
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('response_not_json');
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('response_not_object');
      }

      return parsed as JsonObject;
    } finally {
      clearTimeout(timeout);
    }
  }

  private unwrapData(payload: JsonObject): JsonObject {
    const nested = payload.data;
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
      return payload;
    }
    return nested as JsonObject;
  }

  private pickString(source: JsonObject, keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }
    return null;
  }

  private pickValue(source: JsonObject, keys: string[]): unknown {
    for (const key of keys) {
      if (key in source) {
        return source[key];
      }
    }
    return undefined;
  }

  private parseDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string' && value.trim()) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  private normalizeAnchorStatus(value: unknown): TraceAnchorStatus {
    const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!status) {
      return TRACE_ANCHOR_STATUS.NOT_ANCHORED;
    }

    if (
      status === TRACE_ANCHOR_STATUS.SUCCESS ||
      status === 'confirmed' ||
      status === 'anchored' ||
      status === 'completed' ||
      status === 'ok'
    ) {
      return TRACE_ANCHOR_STATUS.SUCCESS;
    }

    if (
      status === TRACE_ANCHOR_STATUS.PENDING ||
      status === 'submitted' ||
      status === 'processing'
    ) {
      return TRACE_ANCHOR_STATUS.PENDING;
    }

    if (
      status === TRACE_ANCHOR_STATUS.FAILED ||
      status === 'error' ||
      status === 'rejected'
    ) {
      return TRACE_ANCHOR_STATUS.FAILED;
    }

    if (status === TRACE_ANCHOR_STATUS.NOT_ANCHORED) {
      return TRACE_ANCHOR_STATUS.NOT_ANCHORED;
    }

    return TRACE_ANCHOR_STATUS.NOT_ANCHORED;
  }

  private resolveTimeoutMs() {
    const configured = this.configService.get<number>('trace.anchorTimeoutMs');
    if (typeof configured === 'number' && configured >= 1000) {
      return configured;
    }
    return 10000;
  }

  private resolveChainProvider() {
    return this.configService.get<string>('trace.chainProvider') || this.providerKey;
  }

  private resolveChainNetwork() {
    return this.configService.get<string>('trace.chainNetwork') || 'testnet';
  }

  private toSafeErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
