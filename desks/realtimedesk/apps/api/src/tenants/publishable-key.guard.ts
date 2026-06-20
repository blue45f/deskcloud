import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { TenantsService } from "./tenants.service";

import type { AuthedRequest } from "../admin/admin-token.guard";
import type { Request } from "express";

const KEY_HEADER = "x-realtime-key";

function headerValue(req: Request, name: string): string | undefined {
  const h = req.headers[name];
  return Array.isArray(h) ? h[0] : h;
}

/**
 * publishable 키 게이트(브라우저용) — `X-Realtime-Key: pk_…` 로 테넌트를 해석하고
 * Origin 이 테넌트 allowlist 를 통과하는지 검사한 뒤 req.tenant 에 부착.
 * history 처럼 브라우저가 pk 로 부르는 공개 읽기 라우트에 사용.
 */
@Injectable()
export class PublishableKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const pk = headerValue(req, KEY_HEADER);
    const tenant = await this.tenants.findByPublishableKey(pk);
    if (!tenant) {
      throw new UnauthorizedException(
        "유효한 publishable 키(X-Realtime-Key: pk_…)가 필요합니다",
      );
    }
    const origin = headerValue(req, "origin");
    if (!this.tenants.isOriginAllowed(tenant, origin)) {
      throw new UnauthorizedException(
        `Origin 이 허용되지 않습니다: ${origin ?? "(none)"}`,
      );
    }
    req.tenant = tenant;
    return true;
  }
}
