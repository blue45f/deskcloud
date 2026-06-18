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
        <span className="text-sm font-bold tracking-tight text-text">DeskCloud</span>
      )}
    </span>
  )
}
