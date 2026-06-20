import { Global, Module } from '@nestjs/common'

import { AuditService } from '../common/audit.service'
import { PlanService } from '../common/plan.service'
import { APP_CONFIG, loadConfig } from '../config'
import { DatabaseService } from '../db/database.service'

/** 전역 코어 — 설정·DB·감사·플랜 서비스를 모든 모듈에 노출. */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    DatabaseService,
    AuditService,
    PlanService,
  ],
  exports: [APP_CONFIG, DatabaseService, AuditService, PlanService],
})
export class CoreModule {}
