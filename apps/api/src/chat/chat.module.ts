import { Module } from '@nestjs/common'

import { ConversationsModule } from '../conversations/conversations.module'
import { TenantsModule } from '../tenants/tenants.module'

import { ChatGateway } from './chat.gateway'
import { PresenceService } from './presence.service'

/**
 * 채팅 실시간 도메인 — socket.io 게이트웨이(/chat) + presence.
 * ConversationsService 에 브로드캐스터를 등록해 REST 발송/모더레이션/읽음이 실시간 전달된다.
 */
@Module({
  imports: [TenantsModule, ConversationsModule],
  providers: [ChatGateway, PresenceService],
})
export class ChatModule {}
