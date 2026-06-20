import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatNumber } from '@/utils/format'

/**
 * 오프셋 기반 페이지네이션 바 — "n–m / total" 표시 + 이전/다음. 서버가 total 을 돌려주는
 * 목록(검수 큐 등)에서, 한 페이지(limit)씩 넘기며 본다.
 */
export function Pagination({
  offset,
  total,
  count,
  onPrev,
  onNext,
  busy = false,
}: {
  /** 현재 페이지 시작 오프셋(0-based). */
  offset: number
  /** 전체 항목 수(서버 total). */
  total: number
  /** 현재 페이지에 실제로 표시된 항목 수. */
  count: number
  onPrev: () => void
  onNext: () => void
  busy?: boolean
}) {
  const from = total === 0 ? 0 : offset + 1
  const to = offset + count
  const hasPrev = offset > 0
  const hasNext = to < total

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
      <p className="text-xs text-text-subtle" aria-live="polite">
        전체 <span className="font-mono text-text-muted">{formatNumber(total)}</span>건 중{' '}
        <span className="font-mono text-text-muted">
          {formatNumber(from)}–{formatNumber(to)}
        </span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrev}
          disabled={!hasPrev || busy}
          aria-label="이전 페이지"
        >
          <ChevronLeft className="size-4" /> 이전
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onNext}
          disabled={!hasNext || busy}
          aria-label="다음 페이지"
        >
          다음 <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
