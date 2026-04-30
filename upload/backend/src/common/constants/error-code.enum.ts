/**
 * 业务错误码
 * 约定：0 为成功，100x 为通用业务错误
 */
export enum ErrorCode {
  SUCCESS = 0,

  // 通用业务错误
  UNAUTHORIZED = 1001, // 未登录
  BAD_REQUEST = 1002, // 参数错误
  NOT_FOUND = 1003, // 数据不存在
  OPERATION_FAILED = 1004, // 操作失败
  FORBIDDEN = 1005, // 无权限
}

