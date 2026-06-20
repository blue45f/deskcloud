import { Module } from '@nestjs/common'

import { AdminController } from '../admin/admin.controller'
import { ChannelsModule } from '../channels/channels.module'
import { InboxModule } from '../inbox/inbox.module'

import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'
import { TemplatesService } from './templates.service'

/**
 * 알림 도메인 — 발송 파이프라인(notify) + 템플릿 서비스 + 어드민 컨트롤러.
 * InboxModule(발송 로그)·ChannelsModule(어댑터)에 의존. TenantsModule 은 @Global.
 */
@Module({
  imports: [ChannelsModule, InboxModule],
  controllers: [NotificationsController, AdminController],
  providers: [NotificationsService, TemplatesService],
  exports: [NotificationsService, TemplatesService],
})
export class NotificationsModule {}
