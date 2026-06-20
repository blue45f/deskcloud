import { Module } from '@nestjs/common'

import { StatsController } from './stats.controller'
import { VisitsService } from './visits.service'

/**
 * 현황 도메인 — 공개(무인증) 방문 핑 + 플랫폼 와이드 집계.
 * DatabaseService(CoreModule, @Global)·tenants 스키마만 의존하고, 테넌트 가드는 쓰지 않는다.
 */
@Module({
  controllers: [StatsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class StatsModule {}
