/**
 * 위젯 표시용 순수 포매팅 헬퍼 — 의존성 0. 로케일은 호스트 브라우저 기본.
 */
import type { ConversationListItemDto } from '@chatdesk/shared'

/** 대화 표시 이름 — group 은 title 우선, 없으면 멤버 요약. DM 은 상대 멤버(나 제외). */
export function conversationName(conv: ConversationListItemDto, me: string): string {
  if (conv.kind === 'group') {
    if (conv.title) return conv.title
    const others = conv.memberIds.filter((m) => m !== me)
    if (others.length === 0) return '그룹'
    if (others.length <= 3) return others.join(', ')
    return `${others.slice(0, 3).join(', ')} 외 ${others.length - 3}명`
  }
  const other = conv.memberIds.find((m) => m !== me)
  return other ?? conv.memberIds[0] ?? '대화'
}

/** 메시지 미리보기 — 시스템·삭제·첨부 처리. */
export function previewText(conv: ConversationListItemDto): string {
  const m = conv.lastMessage
  if (!m) return '아직 메시지가 없습니다'
  if (m.deleted) return '삭제된 메시지'
  if (m.body) return m.body
  if (m.attachments.length > 0) return `첨부 ${m.attachments.length}개`
  return ''
}

/** 시각 — 오늘이면 HH:MM, 어제는 '어제', 그 외는 M/D. */
export function shortTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return '어제'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 말풍선 시각 — 항상 HH:MM. */
export function clockTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** 날짜 구분선 라벨 — 오늘/어제/전체 날짜. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (d.toDateString() === now.toDateString()) return '오늘'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return '어제'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

/** 같은 날짜(YYYY-MM-DD)인지 — 날짜 구분선 삽입 판단용. */
export function sameDate(aIso: string, bIso: string): boolean {
  const a = new Date(aIso)
  const b = new Date(bIso)
  return a.toDateString() === b.toDateString()
}
