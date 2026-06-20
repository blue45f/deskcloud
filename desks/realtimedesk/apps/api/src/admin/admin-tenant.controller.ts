import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  updateTenantSettingsSchema,
  type TenantDto,
  type TenantUsage,
  type TenantWithSecretDto,
  type UpdateTenantSettingsInput,
} from "@realtimedesk/shared";

import { ZodValidationPipe } from "../common/zod.pipe";
import { TenantsService } from "../tenants/tenants.service";

import { AdminGuard, type AuthedRequest } from "./admin-token.guard";

/**
 * 어드민(테넌트 self-service) — secret 키 또는 전역 X-Admin-Token 으로 통과.
 * sk 로 통과한 경우 그 테넌트를, 전역 토큰만 있는 경우 별도 sk 헤더로 테넌트를 식별해야 한다.
 */
@ApiTags("admin")
@ApiHeader({
  name: "X-Realtime-Key",
  required: false,
  description: "secret 키(sk_…) — 테넌트 식별",
})
@ApiHeader({
  name: "X-Admin-Token",
  required: false,
  description: "전역 어드민 토큰",
})
@Controller("admin/tenant")
@UseGuards(AdminGuard)
export class AdminTenantController {
  constructor(private readonly tenants: TenantsService) {}

  /** AdminGuard 가 sk 로 통과시켰으면 req.tenant 가 있다. 없으면(전역 토큰만) 401. */
  private requireTenantId(req: AuthedRequest): string {
    if (req.tenant) return req.tenant.id;
    throw new UnauthorizedException(
      "테넌트 식별을 위해 secret 키(X-Realtime-Key: sk_…)가 필요합니다",
    );
  }

  @Get()
  @ApiOperation({
    summary: "내 테넌트 단건(키·사용량). secret 키 해시는 노출하지 않음",
  })
  async getTenant(@Req() req: AuthedRequest): Promise<TenantDto> {
    return this.tenants.getDto(this.requireTenantId(req));
  }

  @Get("usage")
  @ApiOperation({ summary: "사용량(messages·connections·cap)" })
  async getUsage(@Req() req: AuthedRequest): Promise<TenantUsage> {
    return this.tenants.getUsage(this.requireTenantId(req));
  }

  @Patch()
  @ApiOperation({
    summary: "테넌트 설정 수정(이름·허용 Origin·요금제). 보낸 필드만 갱신",
  })
  async updateSettings(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateTenantSettingsSchema))
    body: UpdateTenantSettingsInput,
  ): Promise<TenantDto> {
    return this.tenants.updateSettings(this.requireTenantId(req), body);
  }

  @Post("rotate-keys")
  @ApiOperation({
    summary: "키 회전 — 새 pk·sk 발급. 이전 키는 즉시 무효. sk 평문 1회 노출",
  })
  async rotateKeys(@Req() req: AuthedRequest): Promise<TenantWithSecretDto> {
    return this.tenants.rotateKeys(this.requireTenantId(req));
  }
}
