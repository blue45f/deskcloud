import type { ElementType, ReactNode } from 'react'

import { useReveal } from '@/hooks/useReveal'

/**
 * 스크롤 리빌 래퍼 — 자식을 뷰포트 진입 시 한 번 페이드/업 한다.
 * 기본은 항상 보이는 상태로 렌더되고(no-JS/SSR/reduced-motion 안전), 모션이 허용될 때만
 * 진입 애니메이션을 켠다. `as` 로 시맨틱 태그를, `delay` 로 stagger 를 준다.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: ElementType
} & Record<string, unknown>) {
  const ref = useReveal<HTMLElement>(delay)
  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  )
}
