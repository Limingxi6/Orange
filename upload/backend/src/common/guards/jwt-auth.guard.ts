import {
  Injectable,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorCode } from '../constants/error-code.enum';

/**
 * JWT 认证守卫
 * 默认所有接口都需要认证，使用 @Public() 装饰器可跳过
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // 检查是否标记为公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err) {
      throw err;
    }

    if (!user) {
      const message =
        typeof info?.message === 'string' ? info.message : '请先登录';
      throw new BusinessException(
        ErrorCode.UNAUTHORIZED,
        message,
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
  }
}
