import { cn } from '@/utils/cn'

export interface MiniBarRow {
  label: string
  count: number
  /** 선택 — 막대 색(없으면 accent). */
  tone?: 'accent' | 'success' | 'info' | 'warning' | 'danger'
}

const TONE_BG: Record<NonNullable<MiniBarRow['tone']>, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/**
 * 수평 막대 분포 — 선택지 분포·별점 분포 등에 쓰는 작은 차트(의존성 0).
 * 접근성: 각 행은 텍스트 라벨·수치를 그대로 노출하고, 막대는 aria-hidden.
 */
export function MiniBar({
  rows,
  total: totalOverride,
  className,
  emptyText = '집계할 응답이 없습니다.',
}: {
  rows: MiniBarRow[]
  /** 비율 분모(기본: 행 최댓값). 전체 응답 대비로 보고 싶으면 명시. */
  total?: number
  className?: string
  emptyText?: string
}) {
  const sum = rows.reduce((a, r) => a + r.count, 0)
  if (rows.length === 0 || sum === 0) {
    return <p className="text-sm text-text-subtle">{emptyText}</p>
  }
  const denom = Math.max(1, totalOverride ?? Math.max(...rows.map((r) => r.count)))

  return (
    <ul className={cn('space-y-2.5', className)}>
      {rows.map((r) => {
        const pct = Math.round((r.count / denom) * 100)
        return (
          <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[0.8125rem] text-text">{r.label}</span>
                <span className="shrink-0 font-mono text-xs text-text-subtle">{r.count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div
                  className={cn('h-full rounded-full transition-[width]', TONE_BG[r.tone ?? 'accent'])}
                  style={{ width: `${Math.max(pct, r.count > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
            <span className="col-start-2 self-start pt-px font-mono text-xs text-text-subtle">
              {pct}%
            </span>
          </li>
        )
      })}
    </ul>
  )
}
