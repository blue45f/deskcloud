import {
  createTenantSchema,
  updateTenantSchema,
  type CreateTenantInput,
  type TenantDto,
  type TenantWithSecretDto,
  type UpdateTenantInput,
} from '@authdesk/shared'
import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { SecretKeyGuard, tenantOf } from './secret-key.guard'
import { toTenantDto } from './tenant.types'
import { TenantsService } from './tenants.service'

import type { Request } from 'express'

/**
 * 테넌트 API — 가입(공개) + 내 테넌트 관리(secret 키). pk_/sk_ 멀티테넌트 루트.
 * (테넌트 풀의 end-user 인증은 AuthController 가 담당 — 혼동 주의.)
 */
@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: '가입(테넌트 생성) — secret 키는 이 응답에서 1회만 평문 반환' })
  signup(
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput
  ): Promise<TenantWithSecretDto> {
    return this.tenants.signup(body)
  }

  @Get('me')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @ApiOperation({ summary: '내 테넌트 조회 (Authorization: Bearer sk_…)' })
  getMine(@Req() req: Request): TenantDto {
    return toTenantDto(tenantOf(req))
  }

  @Put('me')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @ApiOperation({ summary: '내 테넌트 수정 (name·corsOrigins)' })
  async updateMine(
    @Req() req: Request,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput
  ): Promise<TenantDto> {
    const updated = await this.tenants.update(tenantOf(req).id, body)
    return toTenantDto(updated)
  }

  @Post('me/rotate-keys')
  @HttpCode(200)
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @ApiOperation({ summary: '키 회전 — 새 secret 키 1회 반환(이전 키 즉시 무효)' })
  rotate(@Req() req: Request): Promise<TenantWithSecretDto> {
    return this.tenants.rotateKeys(tenantOf(req).id)
  }
}
