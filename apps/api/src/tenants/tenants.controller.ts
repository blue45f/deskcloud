import {
  createTenantSchema,
  updateTenantSchema,
  type CreateTenantInput,
  type TenantCreatedDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@addesk/shared'
import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { SecretKeyGuard } from '../common/secret-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { TenantsService } from './tenants.service'

/** 테넌트 API — 가입(공개) + 내 테넌트 관리(secret 키 / 어드민 토큰). */
@ApiTags('tenants')
@Controller()
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post('tenants')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '테넌트 가입 — publishable(pk_)·secret(sk_) 키 발급. secret 평문은 이 응답에서만 노출',
  })
  signup(
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput
  ): Promise<TenantCreatedDto> {
    return this.tenants.signup(body)
  }

  @Get('tenant')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '내 테넌트 조회 (x-sk: sk_… 또는 X-Admin-Token)' })
  getTenant(@Req() req: TenantRequest): TenantDto {
    return this.tenants.toDto(tenantOf(req))
  }

  @Put('tenant')
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '내 테넌트 수정 (name·corsOrigins·plan)' })
  updateTenant(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput
  ): Promise<TenantDto> {
    return this.tenants.update(tenantOf(req).id, body)
  }

  @Post('tenant/rotate-keys')
  @HttpCode(200)
  @UseGuards(SecretKeyGuard)
  @ApiSecurity('apiKey')
  @ApiOperation({ summary: '키 회전 — 새 pk_/sk_ 키쌍 1회 반환(이전 키 즉시 무효)' })
  rotate(@Req() req: TenantRequest): Promise<TenantCreatedDto> {
    return this.tenants.rotateKeys(tenantOf(req).id)
  }
}
