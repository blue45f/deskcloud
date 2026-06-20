import { Module } from '@nestjs/common'

import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'

/**
 * 운영 현황 도메인 — 공개 집계(가입·트래픽) 조회 + 방문 핑 기록.
 * 설정·DB 는 @Global CoreModule 이 제공한다.
 */
@Module({
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
