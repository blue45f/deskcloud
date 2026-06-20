import { Module } from '@nestjs/common'

import { AdminConversationsController } from '../admin/admin-conversations.controller'
import { TenantsModule } from '../tenants/tenants.module'

import { ConversationsController } from './conversations.controller'
import { ConversationsService } from './conversations.service'

/**
 * 대화·메시지 도메인 — pk(브라우저)·sk(서버) REST + 어드민(목록·시스템 발송·모더레이션).
 * ConversationsService 는 chat 게이트웨이가 브로드캐스터를 등록해 실시간 전달에 쓴다.
 */
@Module({
  imports: [TenantsModule],
  controllers: [ConversationsController, AdminConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
