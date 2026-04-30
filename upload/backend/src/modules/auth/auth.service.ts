import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { LoginDto } from './dto/login.dto';
import { SendCodeDto } from './dto/send-code.dto';

type UserProfile = {
  userId: number;
  id: number;
  phone: string;
  nickname: string;
  avatar: string;
  role: string;
};

type MemoryCode = {
  code: string;
  expireAt: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly memoryCodeStore = new Map<string, MemoryCode>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: {
        id: true,
        phone: true,
        passwordHash: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, '手机号或密码错误');
    }

    const passwordValid = await this.verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, '手机号或密码错误');
    }

    if (user.status !== 'active') {
      throw new BusinessException(ErrorCode.FORBIDDEN, '账号已被禁用');
    }

    const payload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      nickname: user.nickname ?? '',
    };

    const token = await this.jwtService.signAsync(payload);
    const userInfo: UserProfile = {
      userId: user.id,
      id: user.id,
      phone: user.phone,
      nickname: user.nickname ?? '',
      avatar: user.avatarUrl ?? '',
      role: user.role,
    };

    return {
      token,
      userInfo,
    };
  }

  async sendCode(dto: SendCodeDto) {
    const codeLength = this.configService.get<number>('sms.codeLength', 6);
    const expireSeconds = this.configService.get<number>('sms.expireSeconds', 300);
    const isDev = this.configService.get<boolean>('app.isDev', true);
    const code = this.generateCode(codeLength);
    const key = this.buildCodeKey(dto.phone);

    const cached = await this.getCodeFromCache(key);
    if (cached && cached.expireAt > Date.now()) {
      throw new BusinessException(ErrorCode.OPERATION_FAILED, '验证码发送过于频繁，请稍后再试');
    }

    await this.setCodeToCache(key, code, expireSeconds);

    const response: Record<string, any> = {
      success: true,
      expireIn: expireSeconds,
    };

    // 联调阶段返回调试验证码，方便前端先跑通流程
    if (isDev) {
      response.debugCode = code;
    }

    return response;
  }

  async profile(currentUser: {
    id: number;
    phone: string;
    nickname?: string;
    avatar?: string;
    role: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatarUrl: true,
        role: true,
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
    };
  }

  async logout() {
    // MVP 阶段前端删除 token 即可，后续可扩展 Redis 黑名单
    return { success: true };
  }

  private async verifyPassword(plain: string, stored: string): Promise<boolean> {
    // 优先按 bcrypt 校验
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      return bcrypt.compare(plain, stored);
    }

    // 兼容历史 seed（salt$iterations$hash 的 pbkdf2）
    const segments = stored.split('$');
    if (segments.length === 3) {
      const [salt, iterationsRaw, hash] = segments;
      const iterations = Number(iterationsRaw);
      if (!Number.isNaN(iterations) && salt && hash) {
        const derived = crypto
          .pbkdf2Sync(plain, salt, iterations, 32, 'sha256')
          .toString('hex');
        return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(hash));
      }
    }

    this.logger.warn('Unknown password hash format encountered');
    return false;
  }

  private generateCode(length: number) {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  private buildCodeKey(phone: string) {
    return `auth:sms:code:${phone}`;
  }

  private async setCodeToCache(key: string, code: string, expireSeconds: number) {
    const payload: MemoryCode = {
      code,
      expireAt: Date.now() + expireSeconds * 1000,
    };

    try {
      await this.redisService.setJson(key, payload, expireSeconds);
      return;
    } catch (error) {
      this.logger.warn(`Redis not available, fallback to memory store: ${(error as Error).message}`);
      this.memoryCodeStore.set(key, payload);
    }
  }

  private async getCodeFromCache(key: string): Promise<MemoryCode | null> {
    try {
      const value = await this.redisService.getJson<MemoryCode>(key);
      return value;
    } catch {
      const value = this.memoryCodeStore.get(key);
      if (!value) return null;
      if (value.expireAt <= Date.now()) {
        this.memoryCodeStore.delete(key);
        return null;
      }
      return value;
    }
  }
}

