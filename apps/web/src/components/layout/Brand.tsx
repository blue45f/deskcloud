import { MessagesSquare } from 'lucide-react'

import { cn } from '@/utils/cn'

/**
 * SurveyDesk 워드마크 + 글리프.
 *
 * `lamp` 가 켜지면 글리프 뒤로 은은한 강조 글로우(램프)가 깔리고, 호버 시 한 단계
 * 밝아진다. 헤더처럼 브랜드를 돋보이게 하고 싶은 곳에서만 켠다(장식, aria-hidden).
 */
export function Brand({
  className,
  compact = false,
  lamp = false,
}: {
  className?: string
  compact?: boolean
  lamp?: boolean
}) {
  return (
    <span className={cn('group/brand inline-flex items-center gap-2', className)}>
      <span className="relative grid size-7 shrink-0 place-items-center rounded-md bg-ink text-ink-fg shadow-xs transition-transform duration-200 group-hover/brand:-rotate-6 group-hover/brand:scale-105">
        {lamp ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-2 -z-10 rounded-full bg-accent/25 opacity-70 blur-md transition-opacity duration-300 group-hover/brand:opacity-100"
          />
        ) : null}
        <MessagesSquare className="size-4" aria-hidden />
      </span>
      {compact ? null : (
        <>
          <span className="text-sm font-bold tracking-tight text-text">SurveyDesk</span>
          <span className="rounded-full border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-bold leading-none text-accent-fg">
            BETA
          </span>
        </>
      )}
    </span>
  )
}
