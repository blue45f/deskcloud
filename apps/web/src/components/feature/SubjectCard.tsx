import { Sparkles } from 'lucide-react'

import { Stars } from './Stars'

import type { SubjectAggregate } from '@/services/reviews'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

/** subject(리뷰 대상)별 집계 카드 — 평균 별점·건수·상태 분포. 클릭 시 그 subject 로 필터. */
export function SubjectCard({
  subject,
  active,
  onSelect,
}: {
  subject: SubjectAggregate
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'rounded-lg border bg-surface p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-strong',
        active ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-border-strong'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">
            {subject.subjectLabel ?? subject.subjectId}
          </p>
          <p className="truncate font-mono text-xs text-text-subtle">{subject.subjectId}</p>
        </div>
        {subject.featured > 0 ? (
          <Badge tone="accent" size="sm">
            <Sparkles className="size-3" aria-hidden /> {subject.featured}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-text">
          {subject.avgRating != null ? subject.avgRating.toFixed(1) : '—'}
        </span>
        <Stars value={subject.avgRating ?? 0} size="sm" />
        <span className="text-xs text-text-subtle">승인 {subject.approved}건</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {subject.pending > 0 ? (
          <Badge tone="warning" size="sm" dot>
            대기 {subject.pending}
          </Badge>
        ) : null}
        <Badge tone="neutral" size="sm">
          전체 {subject.total}
        </Badge>
        {subject.rejected > 0 ? (
          <Badge tone="outline" size="sm">
            거절 {subject.rejected}
          </Badge>
        ) : null}
      </div>
    </button>
  )
}
