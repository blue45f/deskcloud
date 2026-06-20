import { Inject, Injectable, Logger } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config'

import type { ChannelAdapter, DeliveryInput, DeliveryOutcome } from './channel.types'
import type { Channel } from '@notifydesk/shared'

/**
 * 웹 푸시 채널(VAPID) — VAPID 키쌍 미설정이면 항상 no-op(skipped 'vapid-unset').
 *
 * 실제 푸시는 구독(PushSubscription) 저장소가 필요하다. 본 단계(Stage 1)에서는 구독
 * 저장소 없이, 키가 설정됐을 때 "발송 의도"만 로그로 기록한다(데모/계약 검증용).
 * 구독 등록 엔드포인트·전송은 후속 단계에서 web-push 패키지로 확장한다.
 */
@Injectable()
export class WebPushAdapter implements ChannelAdapter {
  readonly channel: Channel = 'web_push'
  private readonly logger = new Logger('WebPushChannel')

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  private get configured(): boolean {
    return Boolean(this.cfg.webPush.publicKey && this.cfg.webPush.privateKey)
  }

  async deliver(input: DeliveryInput): Promise<DeliveryOutcome> {
    if (!this.configured) {
      return { status: 'skipped', detail: 'vapid-unset' }
    }
    // 구독 저장소가 아직 없으므로 의도만 기록(키는 설정됨).
    this.logger.log(`[web-push→${input.recipientId}] ${input.title}`)
    return await Promise.resolve({ status: 'delivered', detail: 'queued' })
  }
}
