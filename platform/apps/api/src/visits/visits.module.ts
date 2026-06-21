import { Module } from '@nestjs/common'

import { DatabaseService } from '../db/database.service'
import { DrizzleVisitsStore } from '../stores/drizzle-visits.store'

import { VISITS_STORE } from './tokens'
import { VisitsController } from './visits.controller'
import { VisitsService } from './visits.service'

/**
 * 방문/트래픽 도메인 — 공개 핑·집계(키 인증 없음). 결제·자금 이동 없음.
 * 일별 버킷(daily_visits)을 원자적 upsert 로 증가시키고, 오늘/전체 합계를 돌려준다.
 */
@Module({
  controllers: [VisitsController],
  providers: [
    VisitsService,
    {
      provide: VISITS_STORE,
      useFactory: (dbs: DatabaseService) => new DrizzleVisitsStore(dbs),
      inject: [DatabaseService],
    },
  ],
  exports: [VisitsService],
})
export class VisitsModule {}
