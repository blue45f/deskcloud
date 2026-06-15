import { Module } from '@nestjs/common'

import { DatabaseService } from '../db/database.service'
import { DrizzleSubscriptionStore } from '../stores/drizzle-subscription.store'

import { BillingController } from './billing.controller'
import { BillingService } from './billing.service'
import { SUBSCRIPTION_STORE } from './tokens'

/**
 * 빌링 도메인 — 가격표(공개) + 체크아웃/구독/취소(secret) + 웹훅(서명).
 * TenantService·UsageMeter·APP_CONFIG 는 전역 CoreModule 이 제공한다.
 */
@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: SUBSCRIPTION_STORE,
      useFactory: (dbs: DatabaseService) => new DrizzleSubscriptionStore(dbs),
      inject: [DatabaseService],
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
