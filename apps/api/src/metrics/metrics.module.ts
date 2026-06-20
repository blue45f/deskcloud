import { Module } from '@nestjs/common'

import { AdminStatsController } from '../admin/admin-stats.controller'
import { TenantsModule } from '../tenants/tenants.module'

import { MetricsController } from './metrics.controller'
import { MetricsService } from './metrics.service'

/**
 * 운영 지표 도메인 — 공개 방문 추적(ping)과 어드민 운영 현황(stats).
 * AdminStatsController 의 AdminGuard 가 TenantsService(sk 식별)를 쓰므로 TenantsModule 을 import.
 */
@Module({
  imports: [TenantsModule],
  controllers: [MetricsController, AdminStatsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
