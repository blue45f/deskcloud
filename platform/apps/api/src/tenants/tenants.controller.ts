import { TenantService, UsageMeter, toTenantDto, type TenantRecord } from '@desk/core'
import { SecretKeyGuard, TENANT_SERVICE, USAGE_METER } from '@desk/core/nest'
import {
  createTenantSchema,
  updateTenantSchema,
  usagePeriodSchema,
  USAGE_METRICS,
  checkLimit,
  type CreateTenantInput,
  type TenantDto,
  type TenantWithSecretDto,
  type UpdateTenantInput,
  type UsageSummaryDto,
} from '@desk/shared'
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import type { Request } from 'express'

/** SecretKeyGuard 가 부착한 인증 테넌트를 req 에서 꺼낸다. */
function tenantOf(req: Request): TenantRecord {
  return (req as unknown as Record<string, TenantRecord>)['deskTenant']
}

/**
 * 테넌트 API — 가입(공개) + 내 테넌트 관리(secret 키). 멀티테넌트 코어를 그대로 노출한다.
 */
@ApiTags('tenants')
@Controller()
export class TenantsController {
  constructor(
    @Inject(TENANT_SERVICE) private readonly tenants: TenantService,
    @Inject(USAGE_METER) private readonly usage: UsageMeter
  ) {}

  @Post('tenants')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: '가입(테넌트 생성) — secret 키는 이 응답에서 1회만 평문 반환' })
  signup(
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput
  ): Promise<TenantWithSecretDto> {
    return this.tenants.signup(body)
  }

  @Get('tenant')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 테넌트 조회 (Authorization: Bearer sk_…)' })
  getTenant(@Req() req: Request): TenantDto {
    return toTenantDto(tenantOf(req))
  }

  @Put('tenant')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 테넌트 수정 (name·corsOrigins)' })
  async updateTenant(
    @Req() req: Request,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput
  ): Promise<TenantDto> {
    const updated = await this.tenants.update(tenantOf(req).id, body)
    return toTenantDto(updated)
  }

  @Post('tenant/rotate-keys')
  @HttpCode(200)
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '키 회전 — 새 secret 키 1회 반환(이전 키 즉시 무효)' })
  rotate(@Req() req: Request): Promise<TenantWithSecretDto> {
    return this.tenants.rotateKeys(tenantOf(req).id)
  }

  @Get('usage')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "사용량 조회 — period='current'(기본) 또는 'YYYY-MM'" })
  async getUsage(@Req() req: Request, @Query('period') period?: string): Promise<UsageSummaryDto> {
    const tenant = tenantOf(req)
    const resolved = usagePeriodSchema.parse(period ?? 'current')
    const used = await this.usage.getUsage(tenant.id, resolved)
    return {
      tenantId: tenant.id,
      plan: tenant.plan,
      period: resolved,
      metrics: USAGE_METRICS.map((metric) => {
        const u = used[metric]
        const { limit, remaining } = checkLimit(tenant.plan, metric, u)
        return { metric, used: u, limit, remaining }
      }),
    }
  }
}
