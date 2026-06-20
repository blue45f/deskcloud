import { ImagePlay } from 'lucide-react'

import { cn } from '@/utils/cn'

/**
 * MediaDesk 워드마크 + 글리프.
 * 글리프는 그룹 호버 시 미세하게 기울며 강조 링이 번지는 마이크로 인터랙션을 갖는다
 * (transform/색 변화는 prefers-reduced-motion 에서 전역 규칙으로 완화됨).
 */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('group/brand inline-flex items-center gap-2', className)}>
      <span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-md bg-ink text-ink-fg shadow-sm transition-transform duration-200 group-hover/brand:-rotate-6">
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-accent/0 to-accent/0 opacity-0 transition-opacity duration-300 group-hover/brand:from-accent/40 group-hover/brand:to-info/30 group-hover/brand:opacity-100"
        />
        <ImagePlay className="relative size-4" aria-hidden />
      </span>
      {compact ? null : (
        <>
          <span className="text-sm font-bold tracking-tight text-text">MediaDesk</span>
          <span className="rounded-full border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-bold leading-none text-accent-fg">
            BETA
          </span>
        </>
      )}
    </span>
  )
}
