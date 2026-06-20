import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { type AdminStatsDto } from '@realtimedesk/shared'

import { MetricsService } from '../metrics/metrics.service'

import { AdminGuard } from './admin-token.guard'

/**
 * 운영 현황(어드민) — 플랫폼 전역 가입·트래픽 지표.
 * AdminGuard 로 통과(테넌트 sk **또는** 전역 X-Admin-Token). 가입은 실집계,
 * 트래픽은 추적 누적(tracked-new) — 출처는 DTO 라벨로 구분된다.
 */
@ApiTags('admin')
@ApiHeader({
  name: 'X-Realtime-Key',
  required: false,
  description: 'secret 키(sk_…)',
})
@ApiHeader({
  name: 'X-Admin-Token',
  required: false,
  description: '전역 어드민 토큰',
})
@Controller('admin/stats')
@UseGuards(AdminGuard)
export class AdminStatsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: '운영 현황 — { signups(real), traffic(tracked-new) }',
  })
  async stats(): Promise<AdminStatsDto> {
    return this.metrics.stats()
  }
}
