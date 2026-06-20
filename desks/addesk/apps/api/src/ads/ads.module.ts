import { Module } from '@nestjs/common'

import { AdsController } from './ads.controller'
import { AdsService } from './ads.service'

/** 광고 도메인 — 서빙·추적(공개) + 캠페인/크리에이티브/슬롯 CRUD·통계(어드민). */
@Module({
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
