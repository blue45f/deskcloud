import { type StatsDto } from '@moderationdesk/shared'
import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'

import { SecretKeyGuard } from '../common/secret-key.guard'
import { scopeOf, tenantOf, type TenantRequest } from '../common/tenant-context'

import { StatsService } from './stats.service'

/**
 * 어드민 대시보드 통계 — 인증: x-sk(테넌트 secret) 또는 글로벌 X-Admin-Token.
 * 스코프(tenant/operator)는 가드가 확정하며, 가입(signups) 집계 범위가 그에 따라 달라진다.
 * 글로벌 토큰 사용 시 대상 테넌트를 x-tenant-id / ?tenantId= / x-pk 로 지정(SecretKeyGuard).
 */
@ApiTags('admin')
@ApiHeader({ name: 'X-Sk', required: false, description: '테넌트 secret 키(sk_...)' })
@ApiHeader({
  name: 'X-Admin-Token',
  required: false,
  description: '글로벌 ADMIN_TOKEN(셀프호스트)',
})
@Controller('admin/stats')
@UseGuards(SecretKeyGuard)
export class AdminStatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @ApiOperation({
    summary: '대시보드 요약 — 트래픽(검사)·오늘 방문자(추정)·가입(operator 전체/tenant 본인)',
  })
  getStats(@Req() req: TenantRequest): Promise<StatsDto> {
    return this.stats.getStats(tenantOf(req), scopeOf(req))
  }
}
