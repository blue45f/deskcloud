import { Star } from 'lucide-react'

import { cn } from '@/utils/cn'

const SIZES = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const

/** 별점 표시(읽기 전용). 정수 별점을 채움/빈 별로 렌더. */
export function Stars({
  value,
  size = 'sm',
  className,
}: {
  value: number
  size?: keyof typeof SIZES
  className?: string
}) {
  const v = Math.round(value)
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`5점 만점에 ${value}점`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            SIZES[size],
            n <= v ? 'fill-warning text-warning' : 'fill-none text-border-strong'
          )}
          aria-hidden
        />
      ))}
    </span>
  )
}
