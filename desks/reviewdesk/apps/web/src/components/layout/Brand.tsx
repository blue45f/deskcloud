import { Star } from 'lucide-react'

import { cn } from '@/utils/cn'

/** ReviewDesk 워드마크 + 글리프. */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('group/brand inline-flex items-center gap-2', className)}>
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-ink-fg shadow-xs transition-transform duration-200 ease-out group-hover/brand:-rotate-12 group-hover/brand:scale-110">
        <Star className="size-4 fill-current" aria-hidden />
      </span>
      {compact ? null : (
        <>
          <span className="text-sm font-bold tracking-tight text-text">ReviewDesk</span>
          <span className="rounded-full border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-bold leading-none text-accent-fg">
            BETA
          </span>
        </>
      )}
    </span>
  )
}
