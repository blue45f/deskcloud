import {
  updateTenantSchema,
  type TenantDto,
  type TenantWithKeysDto,
  type UpdateTenantInput,
} from '@changelogdesk/shared'
import { Body, Controller, Get, Put, Post, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'

import { ZodValidationPipe } from '../common/zod.pipe'
import { AdminAuthGuard } from '../tenants/admin-auth.guard'
import { type AuthedRequest } from '../tenants/request-context'
import { resolveAdminTenant } from '../tenants/resolve-admin-tenant'
import { TenantContextService } from '../tenants/tenant-context.service'
import { TenantsService } from '../tenants/tenants.service'

/**
 * 어드민(시크릿 키 x-sk 또는 글로벌 X-Admin-Token) — 테넌트 설정·키·사용량.
 *
 * 대상 테넌트 결정:
 *  - secret-key 인증: 그 키의 테넌트가 곧 대상.
 *  - admin-token 인증(셀프호스트): 헤더 `x-tenant-id` 로 대상 지정(없으면 400).
 */
@ApiTags('admin: tenant')
@ApiHeader({ name: 'x-sk', required: false, description: '테넌트 시크릿 키(sk_…)' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '글로벌 ADMIN_TOKEN' })
@ApiHeader({
  name: 'x-tenant-id',
  required: false,
  description: 'admin-token 인증 시 대상 테넌트 id',
})
@Controller('admin/tenant')
@UseGuards(AdminAuthGuard)
export class AdminTenantController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly ctx: TenantContextService
  ) {}

  @Get()
  @ApiOperation({ summary: '테넌트 설정·키(pk)·사용량 조회' })
  async get(@Req() req: AuthedRequest): Promise<TenantDto> {
    const tenant = await resolveAdminTenant(req, this.ctx)
    return this.tenants.get(tenant.id)
  }

  @Put()
  @ApiOperation({ summary: '테넌트 설정 변경 — corsOrigins / plan' })
  async update(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput
  ): Promise<TenantDto> {
    const tenant = await resolveAdminTenant(req, this.ctx)
    return this.tenants.update(tenant.id, body)
  }

  @Post('rotate-keys')
  @ApiOperation({ summary: '키 회전 — 새 pk/sk 발급(기존 무효화). secretKey 1회 노출' })
  async rotate(@Req() req: AuthedRequest): Promise<TenantWithKeysDto> {
    const tenant = await resolveAdminTenant(req, this.ctx)
    return this.tenants.rotateKeys(tenant.id)
  }
}
