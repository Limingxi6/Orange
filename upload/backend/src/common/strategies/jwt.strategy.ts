import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../exceptions/business.exception';
import { ErrorCode } from '../constants/error-code.enum';

/**
 * JWT Payload 接口
 */
export interface JwtPayload {
  sub: number; // 用户 ID
  phone: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT 策略
 * 从 Authorization: Bearer <token> 中提取并验证 JWT
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  /**
   * 验证 JWT payload，返回用户信息
   * 返回值会被注入到 request.user
   */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatarUrl: true,
        role: true,
      },
    });

    if (!user) {
      throw new BusinessException(
        ErrorCode.UNAUTHORIZED,
        '登录状态无效，请重新登录',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 为兼容现有代码字段命名：对外仍返回 avatar
    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatarUrl,
      role: user.role,
    };
  }
}
