import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { APP_CONFIG, type AppConfig } from "../config";
import { TenantsService, type TenantRow } from "../tenants/tenants.service";

import type { Request } from "express";

/** request 에 부착되는 인증된 테넌트(있으면). 어드민 토큰 전용 통과면 없음. */
export interface AuthedRequest extends Request {
  tenant?: TenantRow;
}

const KEY_HEADER = "x-realtime-key";
const ADMIN_HEADER = "x-admin-token";

function headerValue(req: Request, name: string): string | undefined {
  const h = req.headers[name];
  return Array.isArray(h) ? h[0] : h;
}

/**
 * 어드민 게이트 — 테넌트 secret 키(`X-Realtime-Key: sk_…`) **또는** 전역
 * `X-Admin-Token`(ADMIN_TOKEN) 중 하나로 통과. sk 로 통과하면 해당 테넌트를 req.tenant 에 부착.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const sk = headerValue(req, KEY_HEADER);
    const tenant = await this.tenants.findBySecretKey(sk);
    if (tenant) {
      req.tenant = tenant;
      return true;
    }

    const adminToken = headerValue(req, ADMIN_HEADER);
    if (adminToken && adminToken === this.cfg.adminToken) {
      // 전역 어드민 — 테넌트 컨텍스트는 라우트 핸들러가 별도 식별(현재는 sk 우선).
      return true;
    }

    throw new UnauthorizedException(
      "유효한 X-Realtime-Key(sk_) 또는 X-Admin-Token 이 필요합니다",
    );
  }
}
