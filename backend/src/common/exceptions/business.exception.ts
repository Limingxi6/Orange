import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-code.enum';

/**
 * 统一业务异常
 * 用法：
 * throw new BusinessException(ErrorCode.NOT_FOUND, '批次不存在');
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        code,
        message,
        data: null,
      },
      status,
    );
  }
}

