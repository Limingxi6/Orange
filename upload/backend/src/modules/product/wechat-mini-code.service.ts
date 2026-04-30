import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TokenCache = {
  token: string;
  expiresAt: number;
};

type WechatTokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type WechatErrorResponse = {
  errcode?: number;
  errmsg?: string;
};

type MiniCodeImage = {
  dataUri: string;
  mimeType: string;
};

type WechatMpConfig = {
  appId: string;
  appSecret: string;
  page: string;
  envVersion: 'release' | 'trial' | 'develop';
  width: number;
  autoColor: boolean;
  timeoutMs: number;
};

class WechatApiError extends Error {
  constructor(
    message: string,
    readonly errcode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WechatMiniCodeService {
  private readonly logger = new Logger(WechatMiniCodeService.name);

  private tokenCache: TokenCache | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<boolean>('wechatMp.enabled', false);
  }

  async generateMiniProgramCode(traceCode: string): Promise<MiniCodeImage> {
    const scene = String(traceCode || '').trim();
    if (!scene) {
      throw new Error('traceCode is empty');
    }
    if (scene.length > 32) {
      throw new Error('traceCode exceeds WeChat scene limit(32)');
    }

    const config = this.resolveConfig();

    let token = await this.getAccessToken(false, config);
    try {
      return await this.requestMiniCode(token, scene, config);
    } catch (error) {
      if (!this.isTokenError(error)) {
        throw error;
      }

      token = await this.getAccessToken(true, config);
      return this.requestMiniCode(token, scene, config);
    }
  }

  private resolveConfig(): WechatMpConfig {
    const appId = String(this.configService.get<string>('wechatMp.appId') || '').trim();
    const appSecret = String(this.configService.get<string>('wechatMp.appSecret') || '').trim();
    const page = String(
      this.configService.get<string>('wechatMp.codePage', 'pages/trace-view/index'),
    ).trim();

    const envVersionRaw = String(
      this.configService.get<string>('wechatMp.envVersion', 'release'),
    ).trim();
    const envVersion = this.normalizeEnvVersion(envVersionRaw);

    const width = this.normalizeWidth(this.configService.get<number>('wechatMp.codeWidth', 430));
    const autoColor = this.configService.get<boolean>('wechatMp.codeAutoColor', true) !== false;
    const timeoutMs = this.normalizeTimeoutMs(
      this.configService.get<number>('wechatMp.timeoutMs', 10000),
    );

    if (!appId || !appSecret) {
      throw new Error('wechat mini program appId/appSecret is missing');
    }

    return {
      appId,
      appSecret,
      page: page || 'pages/trace-view/index',
      envVersion,
      width,
      autoColor,
      timeoutMs,
    };
  }

  private normalizeEnvVersion(raw: string): 'release' | 'trial' | 'develop' {
    if (raw === 'trial' || raw === 'develop') {
      return raw;
    }
    return 'release';
  }

  private normalizeWidth(width: number | undefined): number {
    if (typeof width !== 'number' || !Number.isFinite(width)) {
      return 430;
    }
    return Math.max(280, Math.min(1280, Math.round(width)));
  }

  private normalizeTimeoutMs(timeoutMs: number | undefined): number {
    if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs < 1000) {
      return 10000;
    }
    return Math.round(timeoutMs);
  }

  private async getAccessToken(forceRefresh: boolean, config: WechatMpConfig): Promise<string> {
    if (!forceRefresh && this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    if (!forceRefresh && this.tokenPromise) {
      return this.tokenPromise;
    }

    const promise = this.fetchAccessToken(config)
      .then((token) => {
        this.tokenCache = token;
        return token.token;
      })
      .finally(() => {
        this.tokenPromise = null;
      });

    this.tokenPromise = promise;
    return promise;
  }

  private async fetchAccessToken(config: WechatMpConfig): Promise<TokenCache> {
    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', config.appId);
    url.searchParams.set('secret', config.appSecret);

    const response = await this.requestWithTimeout(url.toString(), {
      method: 'GET',
    }, config.timeoutMs);

    const payload = await this.readJsonSafely(response);
    const errcode = this.pickErrCode(payload);
    if (errcode !== null && errcode !== 0) {
      throw new WechatApiError(
        `wechat access_token error: ${errcode}, ${this.pickErrMessage(payload) || 'unknown'}`,
        errcode,
      );
    }

    const data = payload as WechatTokenResponse;
    const token = String(data.access_token || '').trim();
    const expiresInRaw = Number(data.expires_in || 7200);
    const expiresIn = Number.isFinite(expiresInRaw) ? expiresInRaw : 7200;

    if (!token) {
      throw new WechatApiError('wechat access_token is empty');
    }

    const expiresAt = Date.now() + Math.max(expiresIn - 120, 60) * 1000;
    return { token, expiresAt };
  }

  private async requestMiniCode(
    accessToken: string,
    scene: string,
    config: WechatMpConfig,
  ): Promise<MiniCodeImage> {
    const endpoint = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(accessToken)}`;
    const response = await this.requestWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene,
          page: config.page,
          env_version: config.envVersion,
          width: config.width,
          auto_color: config.autoColor,
        }),
      },
      config.timeoutMs,
    );

    const contentType = String(response.headers.get('content-type') || '');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (this.looksLikeJson(contentType, buffer)) {
      const parsed = this.parseJsonBuffer(buffer);
      const errcode = this.pickErrCode(parsed);
      throw new WechatApiError(
        `wechat mini code error: ${errcode ?? 'unknown'}, ${this.pickErrMessage(parsed) || 'unknown'}`,
        errcode ?? undefined,
      );
    }

    if (!response.ok || buffer.length === 0) {
      throw new WechatApiError(`wechat mini code http failed: ${response.status}`);
    }

    const mimeType = this.resolveImageMimeType(contentType);
    return {
      mimeType,
      dataUri: `data:${mimeType};base64,${buffer.toString('base64')}`,
    };
  }

  private async requestWithTimeout(
    endpoint: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(endpoint, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      const message = this.toSafeErrorMessage(error);
      this.logger.warn(
        `Wechat request failed endpoint=${this.maskTokenInUrl(endpoint)}, reason=${message}`,
      );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private looksLikeJson(contentType: string, buffer: Buffer): boolean {
    if (contentType.toLowerCase().includes('application/json')) {
      return true;
    }

    const text = buffer.toString('utf8', 0, Math.min(buffer.length, 80)).trimStart();
    return text.startsWith('{') || text.startsWith('[');
  }

  private parseJsonBuffer(buffer: Buffer): unknown {
    const text = buffer.toString('utf8');
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  private async readJsonSafely(response: Response): Promise<unknown> {
    const text = await response.text().catch(() => '');
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  private resolveImageMimeType(contentType: string): string {
    const normalized = String(contentType || '').toLowerCase();
    if (normalized.includes('image/jpeg') || normalized.includes('image/jpg')) {
      return 'image/jpeg';
    }
    if (normalized.includes('image/png')) {
      return 'image/png';
    }
    return 'image/png';
  }

  private pickErrCode(value: unknown): number | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const raw = (value as WechatErrorResponse).errcode;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    return null;
  }

  private pickErrMessage(value: unknown): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const raw = (value as WechatErrorResponse).errmsg;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    return null;
  }

  private isTokenError(error: unknown): boolean {
    if (!(error instanceof WechatApiError)) {
      return false;
    }

    // invalid credential / expired token / invalid token
    return error.errcode === 40001 || error.errcode === 40014 || error.errcode === 42001;
  }

  private toSafeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private maskTokenInUrl(url: string): string {
    return String(url).replace(/(access_token=)[^&]+/gi, '$1***');
  }
}
