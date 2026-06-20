import { Global, Module } from '@nestjs/common'

import { APP_CONFIG, loadConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { TenantContextService } from '../tenants/tenant-context.service'

/** 전역 코어 — 설정·DB·테넌트 인증 컨텍스트를 모든 모듈에 노출. */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    DatabaseService,
    TenantContextService,
  ],
  exports: [APP_CONFIG, DatabaseService, TenantContextService],
})
export class CoreModule {}
