import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  createTenantSchema,
  updateTenantSchema,
  type CreateTenantInput,
  type TenantCreatedDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@reviewdesk/shared'

import { SecretKeyGuard } from '../common/secret-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { TenantsService } from './tenants.service'

/** 테넌트 셀프 가입(공개) — publishable + secret 키 발급. */
@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '테넌트 셀프 가입 — publishable 키 + secret 키(1회 노출) 반환',
  })
  signup(
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput
  ): Promise<TenantCreatedDto> {
    return this.tenants.createTenant(body)
  }
}

/** 어드민 테넌트 설정(secret 또는 글로벌 토큰). */
@ApiTags('admin')
@ApiHeader({ name: 'X-Sk', required: false, description: '테넌트 secret 키(sk_...)' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '글로벌 ADMIN_TOKEN(셀프호스트)' })
@Controller('admin/tenant')
@UseGuards(SecretKeyGuard)
export class AdminTenantController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @ApiOperation({ summary: '내 테넌트 설정·usage·키(공개 정보)' })
  get(@Req() req: TenantRequest): Promise<TenantDto> {
    return this.tenants.getTenant(tenantOf(req).id)
  }

  @Put()
  @ApiOperation({ summary: '설정 수정(name·corsOrigins·autoApprove·plan)' })
  update(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput
  ): Promise<TenantDto> {
    return this.tenants.updateTenant(tenantOf(req).id, body)
  }

  @Post('rotate-keys')
  @ApiOperation({ summary: '키 회전 — 새 publishable/secret(secret 1회 노출). 기존 키 즉시 무효' })
  rotate(@Req() req: TenantRequest): Promise<TenantCreatedDto> {
    return this.tenants.rotateKeys(tenantOf(req).id)
  }
}
