import type { ReactionCounts, ReactionKind } from '@communitydesk/shared'

import { cn } from '@/utils/cn'

const REACTION_EMOJI: Record<ReactionKind, string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡',
}

const ORDER: ReactionKind[] = ['like', 'love', 'laugh', 'wow', 'sad', 'angry']

/** 글/댓글의 반응 집계를 작은 칩들로 표시(0 인 종류는 생략). */
export function ReactionChips({
  reactions,
  className,
}: {
  reactions: ReactionCounts
  className?: string
}) {
  const present = ORDER.filter((k) => (reactions[k] ?? 0) > 0)
  if (present.length === 0) {
    return <span className={cn('text-xs text-text-subtle', className)}>반응 없음</span>
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {present.map((k) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted"
          title={k}
        >
          <span aria-hidden>{REACTION_EMOJI[k]}</span>
          <span className="font-mono">{reactions[k]}</span>
        </span>
      ))}
    </span>
  )
}
