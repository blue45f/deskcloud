import { Module } from '@nestjs/common'

import { AdminStatsController } from './stats.controller'
import { StatsService } from './stats.service'

/** 대시보드 통계 도메인 — 어드민 트래픽/애널리틱스 요약. */
@Module({
  controllers: [AdminStatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
