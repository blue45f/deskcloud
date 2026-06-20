import { Module } from '@nestjs/common'

import { InboxController } from './inbox.controller'
import { InboxService } from './inbox.service'

/** 인박스 도메인 — 공개(publishable) 목록·읽음·미읽음. 발송 로그(어드민)도 InboxService 가 제공. */
@Module({
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
