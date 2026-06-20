import type { Channel } from '@notifydesk/shared'

/** 채널 1건 전달 입력 — 렌더된 제목/본문 + 수신자 컨텍스트. */
export interface DeliveryInput {
  recipientId: string
  /** email 채널용 주소(있을 때만). */
  email?: string
  title: string
  body: string
  data?: Record<string, unknown>
}

/** 채널 어댑터 전달 결과. */
export interface DeliveryOutcome {
  status: 'delivered' | 'skipped' | 'failed'
  detail?: string
}

/** 채널 어댑터 — 비 in_app 채널(email·web_push)의 전달 구현. */
export interface ChannelAdapter {
  readonly channel: Channel
  deliver(input: DeliveryInput): Promise<DeliveryOutcome>
}
