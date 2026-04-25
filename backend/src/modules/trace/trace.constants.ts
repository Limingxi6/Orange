export const TRACE_PROOF_TYPE = {
  HASH: 'hash',
} as const;

export type TraceProofType = (typeof TRACE_PROOF_TYPE)[keyof typeof TRACE_PROOF_TYPE];

export const TRACE_VERIFY_STATUS = {
  VERIFIED: 'verified',
  FAILED: 'failed',
} as const;

export type TraceVerifyStatus =
  (typeof TRACE_VERIFY_STATUS)[keyof typeof TRACE_VERIFY_STATUS];

export const TRACE_ANCHOR_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  NOT_ANCHORED: 'not_anchored',
} as const;

export type TraceAnchorStatus =
  (typeof TRACE_ANCHOR_STATUS)[keyof typeof TRACE_ANCHOR_STATUS];

export const TRACE_ANCHOR_STATUS_VALUES = Object.values(
  TRACE_ANCHOR_STATUS,
) as TraceAnchorStatus[];

export const TRACE_ANCHOR_PROVIDER_KEY = {
  HASH: 'hash',
  EVM: 'evm',
  NOTARY: 'notary',
} as const;

export type TraceAnchorProviderKey =
  (typeof TRACE_ANCHOR_PROVIDER_KEY)[keyof typeof TRACE_ANCHOR_PROVIDER_KEY];

export const TRACE_ANCHOR_PROVIDER_KEY_VALUES = Object.values(
  TRACE_ANCHOR_PROVIDER_KEY,
) as TraceAnchorProviderKey[];

export const TRACE_PROOF_SNAPSHOT_VERSION = 1;

export const TRACE_VERIFY_MESSAGE = {
  VERIFIED: '哈希校验通过',
  FAILED: '哈希校验失败，溯源快照与当前数据不一致',
  NOT_FOUND: '未找到可校验的溯源记录',
  GENERATED: '快照生成完成（链下哈希存证）',
} as const;
