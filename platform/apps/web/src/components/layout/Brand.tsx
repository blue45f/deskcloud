import { Boxes } from 'lucide-react'

import { cn } from '@/utils/cn'

/** DeskCloud 워드마크 + 글리프(플랫폼 코어 — 여러 Desk 의 묶음). */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-ink-fg">
        <Boxes className="size-4" aria-hidden />
      </span>
      {compact ? null : (
        <>
          <span className="text-sm font-bold tracking-tight text-text">DeskCloud</span>
          <span className="rounded-full border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-bold leading-none text-accent-fg">
            BETA
          </span>
        </>
      )}
    </span>
  )
}
