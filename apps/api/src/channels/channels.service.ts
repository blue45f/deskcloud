import { Injectable } from '@nestjs/common'

import { EmailAdapter } from './email.adapter'
import { WebPushAdapter } from './web-push.adapter'

import type { ChannelAdapter, DeliveryInput, DeliveryOutcome } from './channel.types'
import type { Channel } from '@notifydesk/shared'

/**
 * 채널 디스패처 — 비 in_app 채널(email·web_push)을 어댑터로 전달한다.
 * in_app 은 알림 저장 그 자체이므로 여기서 다루지 않는다(서비스가 직접 insert).
 */
@Injectable()
export class ChannelsService {
  private readonly adapters: Map<Channel, ChannelAdapter>

  constructor(email: EmailAdapter, webPush: WebPushAdapter) {
    this.adapters = new Map<Channel, ChannelAdapter>([
      [email.channel, email],
      [webPush.channel, webPush],
    ])
  }

  /** 단일 비-in_app 채널 전달. 어댑터가 없으면 skipped. */
  async deliver(channel: Channel, input: DeliveryInput): Promise<DeliveryOutcome> {
    if (channel === 'in_app') {
      // in_app 은 알림 저장으로 갈음 — 항상 delivered.
      return { status: 'delivered', detail: 'stored' }
    }
    const adapter = this.adapters.get(channel)
    if (!adapter) return { status: 'skipped', detail: 'no-adapter' }
    return adapter.deliver(input)
  }
}
