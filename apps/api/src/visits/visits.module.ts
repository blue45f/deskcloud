import { Module } from '@nestjs/common'

import { VisitsController } from './visits.controller'
import { VisitsService } from './visits.service'

/**
 * 방문 집계 도메인 — 공개 핑(VisitsController) 으로 일별 버킷을 누적하고,
 * VisitsService 를 export 해 어드민 overview(AdminController) 가 합계를 읽게 한다.
 */
@Module({
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
