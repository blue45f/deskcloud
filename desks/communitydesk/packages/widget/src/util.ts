/** 위젯 공용 유틸 — 의존성 0. 상대 시간 표기 + 반응 이모지/라벨. */
import { REACTION_KINDS, type ReactionKind } from '@communitydesk/shared'

/** ISO 문자열을 한국어 상대 시간으로(방금 / n분 전 / n시간 전 / n일 전 / 날짜). */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, now - t)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '방금'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  const d = new Date(t)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return y === new Date(now).getFullYear() ? `${m}.${dd}` : `${y}.${m}.${dd}`
}

/** 반응 종류별 이모지 + 접근성 라벨. */
export const REACTION_META: Record<ReactionKind, { emoji: string; label: string }> = {
  like: { emoji: '👍', label: '좋아요' },
  love: { emoji: '❤️', label: '최고예요' },
  laugh: { emoji: '😂', label: '웃겨요' },
  wow: { emoji: '😮', label: '놀라워요' },
  sad: { emoji: '😢', label: '슬퍼요' },
  angry: { emoji: '😡', label: '화나요' },
}

/** 렌더 순서가 고정된 반응 종류 목록(공유 상수 재노출). */
export const REACTION_ORDER: readonly ReactionKind[] = REACTION_KINDS
