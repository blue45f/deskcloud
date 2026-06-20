import type { FacetCount } from '@searchdesk/shared'

import { cn } from '@/utils/cn'

/**
 * 패싯 카운트 목록 — category(단일 선택) · tags(AND 토글). 클릭하면 필터를 적용한다.
 * 검색 테스터에서 결과 옆 사이드바로 사용. 접근성: 토글 버튼은 aria-pressed 로 상태 노출.
 */
export function FacetList({
  title,
  facets,
  mode,
  selected,
  onToggle,
}: {
  title: string
  facets: FacetCount[]
  /** single = category(하나만), multi = tags(여러 개 AND). */
  mode: 'single' | 'multi'
  /** 선택된 값들(category 면 0~1개). */
  selected: string[]
  onToggle: (value: string) => void
}) {
  if (facets.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-subtle uppercase">
          {title}
        </h3>
        <p className="text-xs text-text-subtle">해당 패싯이 없습니다.</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-text-subtle uppercase">
        {title}
        {mode === 'multi' ? <span className="ml-1 normal-case text-text-subtle">(AND)</span> : null}
      </h3>
      <ul className="space-y-1">
        {facets.map((f) => {
          const isSelected = selected.includes(f.value)
          return (
            <li key={f.value}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggle(f.value)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[0.8125rem] transition-colors',
                  isSelected
                    ? 'bg-accent-soft text-accent-fg'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text'
                )}
              >
                <span className="min-w-0 truncate">{f.value}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 font-mono text-[0.6875rem] tabular-nums',
                    isSelected ? 'bg-accent/20 text-accent-fg' : 'bg-surface-2 text-text-subtle'
                  )}
                >
                  {f.count}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
