import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../interfaces/response.interface';
import { ErrorCode } from '../constants/error-code.enum';
import { BusinessException } from '../exceptions/business.exception';

/**
 * 全局 HTTP 异常过滤器
 * 将所有异常转换为统一的 { code, message, data } 格式
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let code: number | undefined;

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, any>;

        // 如果异常中已明确给出业务 code，直接透传
        if (typeof res.code === 'number') {
          code = res.code;
        }

        message = res.message || exception.message;
        if (Array.isArray(message)) {
          message = message[0];
        }
      } else {
        message = exception.message;
      }

      // 未显式指定业务码时，根据 HTTP 状态映射到业务码
      if (code === undefined) {
        code = this.mapHttpStatusToBusinessCode(status);
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message || '操作失败';
      code = ErrorCode.OPERATION_FAILED;

      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '操作失败';
      code = ErrorCode.OPERATION_FAILED;
    }

    const errorResponse: ApiResponse<null> = {
      code: code ?? ErrorCode.OPERATION_FAILED,
      message,
      data: null,
    };

    this.logger.warn(
      `[${request.method}] ${request.url} - ${status} - ${message}`,
    );

    response.status(status).json(errorResponse);
  }

  private mapHttpStatusToBusinessCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      default:
        return ErrorCode.OPERATION_FAILED;
    }
  }
}
