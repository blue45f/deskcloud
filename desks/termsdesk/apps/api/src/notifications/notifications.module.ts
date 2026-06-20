import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'

import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'

/**
 * 인앱 알림 — DatabaseService 는 CoreModule(@Global) 제공, SessionGuard 는 AuthModule.
 * NotificationsService 를 export 해 BrokerageModule 이 이벤트 시 통지에 사용.
 */
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
