import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SELF_OR_ADMIN_KEY } from '../decorators/self-or-admin.decorator';
import { UserRole } from '../enums/user-role.enum';

type RequestUser = {
  id: number;
  role: string;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const allowSelfOrAdmin = this.reflector.getAllAndOverride<boolean>(
      SELF_OR_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length && !allowSelfOrAdmin) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      return false;
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (requiredRoles?.length && requiredRoles.includes(user.role as UserRole)) {
      return true;
    }

    if (allowSelfOrAdmin) {
      const targetUserId = this.extractTargetUserId(request);
      if (targetUserId !== null && targetUserId === user.id) {
        return true;
      }
      throw new ForbiddenException('仅允许访问自己的数据');
    }

    throw new ForbiddenException('无权限访问该资源');
  }

  private extractTargetUserId(request: any): number | null {
    const candidates = [
      request?.params?.userId,
      request?.params?.id,
      request?.query?.userId,
      request?.query?.id,
      request?.body?.userId,
      request?.body?.id,
    ];

    for (const value of candidates) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return null;
  }
}
