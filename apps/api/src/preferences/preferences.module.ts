import { Module } from '@nestjs/common'

import { PreferencesController } from './preferences.controller'
import { PreferencesService } from './preferences.service'

/** 선호 도메인 — 공개(publishable) 조회/갱신. 발송 게이팅은 NotificationsService 가 직접 조회. */
@Module({
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
