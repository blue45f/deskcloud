import { cn } from '@/utils/cn'

export function SealMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden role="img">
      <rect width="32" height="32" rx="7" className="fill-accent" />
      <path
        d="M9 8h10.5l5.5 5.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
        className="fill-accent-fg"
        fillOpacity="0.92"
      />
      <circle cx="16" cy="18" r="3.4" className="fill-none stroke-accent" strokeWidth="1.7" />
    </svg>
  )
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <SealMark />
      <span className="text-[0.95rem] font-bold tracking-tight text-text">TermsDesk</span>
      <span className="rounded-full border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-bold leading-none text-accent-fg">
        BETA
      </span>
    </div>
  )
}
