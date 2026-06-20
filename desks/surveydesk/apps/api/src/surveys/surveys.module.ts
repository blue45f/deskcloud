import { Module } from '@nestjs/common'

import { AdminSurveysController } from '../admin/admin-surveys.controller'

import { SurveysPublicController } from './surveys.controller'
import { SurveysService } from './surveys.service'

/** 설문 도메인 — 공개(위젯) + 어드민 컨트롤러가 동일 서비스를 공유. */
@Module({
  controllers: [SurveysPublicController, AdminSurveysController],
  providers: [SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}
