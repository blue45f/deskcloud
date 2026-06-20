import { Module } from '@nestjs/common'

import { ChannelsService } from './channels.service'
import { EmailAdapter } from './email.adapter'
import { WebPushAdapter } from './web-push.adapter'

/** 채널 어댑터 모음 — email(console/SMTP)·web-push(VAPID). 발송 파이프라인이 사용. */
@Module({
  providers: [EmailAdapter, WebPushAdapter, ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
