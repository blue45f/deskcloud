import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { PoliciesModule } from '../policies/policies.module'
import { RealtimeModule } from '../realtime/realtime.module'

import { AttachmentStorageService } from './attachment-storage.service'
import {
  BrokerageController,
  MarketplaceController,
  ProvidersController,
  RequestsController,
} from './brokerage.controller'
import { BrokerageService } from './brokerage.service'

/**
 * 약관 의뢰 중계(Brokerage) — 의뢰자·전문가 마켓플레이스.
 * DatabaseService·AuditService 는 CoreModule(@Global) 제공. SessionGuard 는 AuthModule.
 * PoliciesModule 은 완료 산출물 → 약관 버전 가져오기(PoliciesService·VersionsService)용.
 */
@Module({
  imports: [AuthModule, PoliciesModule, NotificationsModule, RealtimeModule],
  controllers: [
    RequestsController,
    MarketplaceController,
    ProvidersController,
    BrokerageController,
  ],
  providers: [AttachmentStorageService, BrokerageService],
})
export class BrokerageModule {}
