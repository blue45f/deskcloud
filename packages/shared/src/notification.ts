/**
 * 인앱 알림 — 약관 의뢰 중계 이벤트(제안·수락·진행·납품·완료·평가·메시지)를 수신자에게 통지.
 * 외부 발송(이메일/푸시) 없이 앱 내 피드 + 안 읽음 배지로만 노출한다.
 */

export const NOTIFICATION_TYPES = [
  'proposal_received',
  'proposal_accepted',
  'work_started',
  'work_delivered',
  'revision_requested',
  'request_completed',
  'review_received',
  'message_received',
  'request_cancelled',
  'request_flagged',
  'dispute_resolved',
  'escrow_released',
  'escrow_refunded',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  proposal_received: '새 제안',
  proposal_accepted: '제안 수락',
  work_started: '작업 시작',
  work_delivered: '산출물 제출',
  revision_requested: '재작업 요청',
  request_completed: '의뢰 완료',
  review_received: '새 평가',
  message_received: '새 메시지',
  request_cancelled: '의뢰 취소',
  request_flagged: '분쟁 접수',
  dispute_resolved: '분쟁 종료',
  escrow_released: '정산 결정',
  escrow_refunded: '환불 결정',
}

export interface NotificationDto {
  id: string
  type: NotificationType
  title: string
  body: string
  /** 연결 대상 의뢰 id(있으면 클릭 시 상세로 이동). */
  requestId: string | null
  /** 읽은 시각(ISO) 또는 null(안 읽음). */
  readAt: string | null
  createdAt: string
}

export interface NotificationListDto {
  items: NotificationDto[]
  total: number
  unreadCount: number
}

export interface UnreadCountDto {
  count: number
}
