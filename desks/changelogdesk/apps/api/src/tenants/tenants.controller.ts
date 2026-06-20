import {
  createTenantSchema,
  type CreateTenantInput,
  type TenantWithKeysDto,
} from '@changelogdesk/shared'
import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { TenantsService } from './tenants.service'

/** 공개(무인증) — 외부 서비스 셀프서브 온보딩 진입점. */
@ApiTags('tenants (public onboarding)')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '테넌트 셀프서브 가입 — pk/sk 발급. secretKey 는 이 응답에서만 1회 노출',
  })
  signup(
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput
  ): Promise<TenantWithKeysDto> {
    return this.tenants.signup(body)
  }
}
