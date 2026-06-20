import { cn } from '@/utils/cn'

export interface MiniBarPoint {
  /** 고유 키(예: YYYY-MM-DD). */
  key: string
  /** 호버 타이틀에 쓰는 사람용 라벨. */
  label: string
  value: number
}

/**
 * 외부 차트 라이브러리 없이 CSS 로 그리는 미니 바(스파크) 차트.
 * 값 0 인 버킷도 자리(고스트 바)를 차지해 연속 구간이 그대로 보인다.
 */
export function MiniBarChart({
  points,
  ariaLabel,
  className,
}: {
  points: MiniBarPoint[]
  /** 스크린리더용 요약(예: "최근 30일 동의 추이, 총 12건"). */
  ariaLabel: string
  className?: string
}) {
  const max = Math.max(...points.map((p) => p.value), 1)
  return (
    <div role="img" aria-label={ariaLabel} className={cn('flex h-16 items-end gap-px', className)}>
      {points.map((p) => (
        <div key={p.key} className="group flex h-full flex-1 items-end" title={p.label}>
          <div
            data-bar={p.key}
            className={cn(
              'w-full rounded-sm transition-colors',
              p.value > 0
                ? 'bg-accent group-hover:bg-accent-strong'
                : 'bg-surface-2 group-hover:bg-border'
            )}
            style={{ height: p.value > 0 ? `${Math.max((p.value / max) * 100, 8)}%` : '3px' }}
          />
        </div>
      ))}
    </div>
  )
}
