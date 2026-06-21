import { TenantService, UsageMeter } from '@desk/core'
import { CORE_OPTIONS, TENANT_SERVICE, USAGE_METER, type CoreOptions } from '@desk/core/nest'
import { Global, Module } from '@nestjs/common'

import { APP_CONFIG, loadConfig, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { DrizzleMemberStore } from '../stores/drizzle-member.store'
import { DrizzleTenantStore } from '../stores/drizzle-tenant.store'
import { DrizzleUsageStore } from '../stores/drizzle-usage.store'

import { InquiryReadAdminGuard, InquiryWriteAdminGuard } from './admin-scope.guards'

/** 멤버 스토어 DI 토큰(api 로컬). */
export const MEMBER_STORE = Symbol('MEMBER_STORE')

/**
 * 전역 코어 — 설정·DB·멀티테넌트 서비스를 모든 모듈에 노출.
 * core 의 가드(@desk/core/nest)가 기대하는 토큰(TENANT_SERVICE·USAGE_METER·CORE_OPTIONS)을
 * 여기서 Drizzle 스토어로 바인딩한다.
 */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    DatabaseService,
    {
      provide: TENANT_SERVICE,
      useFactory: (dbs: DatabaseService, cfg: AppConfig) =>
        new TenantService(new DrizzleTenantStore(dbs), cfg.keyPepper),
      inject: [DatabaseService, APP_CONFIG],
    },
    {
      provide: USAGE_METER,
      useFactory: (dbs: DatabaseService) => new UsageMeter(new DrizzleUsageStore(dbs)),
      inject: [DatabaseService],
    },
    {
      provide: MEMBER_STORE,
      useFactory: (dbs: DatabaseService) => new DrizzleMemberStore(dbs),
      inject: [DatabaseService],
    },
    {
      provide: CORE_OPTIONS,
      useFactory: (cfg: AppConfig): CoreOptions => ({
        adminToken: cfg.adminToken,
        adminAccounts: cfg.adminAccounts,
      }),
      inject: [APP_CONFIG],
    },
    InquiryReadAdminGuard,
    InquiryWriteAdminGuard,
  ],
  exports: [
    APP_CONFIG,
    DatabaseService,
    TENANT_SERVICE,
    USAGE_METER,
    MEMBER_STORE,
    CORE_OPTIONS,
    InquiryReadAdminGuard,
    InquiryWriteAdminGuard,
  ],
})
export class CoreModule {}
