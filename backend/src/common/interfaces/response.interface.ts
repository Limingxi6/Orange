/**
 * 统一响应接口定义
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * 分页数据接口
 */
export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 分页响应接口
 */
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;
