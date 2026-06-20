import { Module } from '@nestjs/common'

import { AdminReportsController, ReportsPublicController } from './reports.controller'
import { ReportsService } from './reports.service'

/** 신고 도메인 — 공개(접수) + 어드민(조회·전이) 컨트롤러가 동일 서비스를 공유. */
@Module({
  controllers: [ReportsPublicController, AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
