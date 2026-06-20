import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  createTenantSchema,
  type CreateTenantInput,
  type TenantWithSecretDto,
} from "@realtimedesk/shared";

import { ZodValidationPipe } from "../common/zod.pipe";

import { TenantsService } from "./tenants.service";

/** 공개 가입 — 외부 테넌트가 등록하고 pk·sk 키를 받는다. sk 평문은 응답 1회만. */
@ApiTags("tenants (public)")
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "테넌트 가입 — pk(브라우저)·sk(서버) 키 발급. secret 키는 이 응답에서만 평문 노출",
  })
  signup(
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput,
  ): Promise<TenantWithSecretDto> {
    return this.tenants.create(body);
  }
}
