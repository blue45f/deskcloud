import {
  createTenantSchema,
  updateTenantSchema,
  type CreateTenantInput,
  type TenantCredentialsDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@filedesk/shared'
import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { SecretKeyGuard } from './secret-key.guard'
import { getTenantCtx, type AuthedRequest } from './tenant-context'
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
  ): Promise<TenantCredentialsDto> {
    return this.tenants.signup(body)
  }

  @Get('tenant')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('apiKey')
  @ApiOperation({ summary: '내 테넌트 조회 (Authorization: Bearer sk_… 또는 X-Admin-Token)' })
  getTenant(@Req() req: AuthedRequest): TenantDto {
    return this.tenants.toDto(getTenantCtx(req).tenant)
  }

  @Put('tenant')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('apiKey')
  @ApiOperation({ summary: '내 테넌트 수정 (name·corsOrigins·plan)' })
  updateTenant(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput
  ): Promise<TenantDto> {
    return this.tenants.update(getTenantCtx(req).tenant.id, body)
  }

  @Post('tenant/rotate-keys')
  @HttpCode(200)
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('apiKey')
  @ApiOperation({ summary: '키 회전 — 새 pk_/sk_ 키쌍 1회 반환(이전 키 즉시 무효)' })
  rotate(@Req() req: AuthedRequest): Promise<TenantCredentialsDto> {
    return this.tenants.rotateKeys(getTenantCtx(req).tenant.id)
  }
}
