import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfileById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '用户不存在');
    }

    return {
      userId: user.id,
      id: user.id,
      phone: user.phone,
      nickname: user.nickname ?? '',
      avatar: user.avatarUrl ?? '',
      role: user.role,
      status: user.status,
    };
  }

  isAdmin(role: string) {
    return role === UserRole.ADMIN;
  }
}
