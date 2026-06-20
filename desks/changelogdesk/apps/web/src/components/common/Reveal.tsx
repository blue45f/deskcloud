import type { ElementType, ReactNode } from 'react'

import { useReveal } from '@/hooks/useReveal'
import { cn } from '@/utils/cn'

/**
 * 스크롤 리빌 래퍼 — 자식이 뷰포트에 들어올 때 위로 떠오르며 페이드인한다.
 * `prefers-reduced-motion` 에서는 즉시 가시 상태로 폴백한다(CSS `.cd-reveal` 규칙).
 *
 * - `delay` (ms): 스태거 그리드용 진입 지연.
 * - `as`: 렌더 태그(기본 div). 시맨틱이 필요한 곳에서 'li' 등으로 교체.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: ElementType
}) {
  const { ref, revealed } = useReveal()
  return (
    <Tag
      ref={ref}
      className={cn('cd-reveal', revealed && 'is-revealed', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
