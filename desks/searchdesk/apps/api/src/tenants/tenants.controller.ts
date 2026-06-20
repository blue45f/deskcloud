import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { createTenantSchema, type CreateTenantInput, type TenantCredentialsDto } from '@searchdesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'

import { TenantsService } from './tenants.service'

/** 공개(무인증) — 테넌트 셀프 가입. publishable/secret 키쌍을 발급한다(secret 평문 1회 노출). */
@ApiTags('tenants (public signup)')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '테넌트 가입 — publishable(pk_)·secret(sk_) 키 발급. secret 평문은 이 응답에서만 노출',
  })
  signup(
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput
  ): Promise<TenantCredentialsDto> {
    return this.tenants.signup(body)
  }
}
