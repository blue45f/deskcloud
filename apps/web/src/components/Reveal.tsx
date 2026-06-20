import type { CSSProperties, ElementType, ReactElement, ReactNode } from 'react'

import { revealClass, useReveal } from '@/app/useReveal'

/**
 * 스크롤 진입 시 페이드-업으로 드러나는 래퍼.
 * 이미 보이는 콘텐츠를 강화만 한다 — 뷰포트 아래 요소만 무장(arm)되며, JS/IO 미동작·
 * 리듀스드모션이면 클래스 없이 그대로 보인다(빈 화면 없음). `index` 로 스태거 지연.
 */
export function Reveal({
  as,
  index = 0,
  className,
  style,
  children,
}: {
  as?: ElementType
  index?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}): ReactElement {
  const Tag = (as ?? 'div') as ElementType
  const { ref, state } = useReveal<HTMLElement>()
  const classes = [className, revealClass(state)].filter(Boolean).join(' ')

  return (
    <Tag
      ref={ref}
      data-reveal=""
      className={classes || undefined}
      style={{ ...style, '--fd-reveal-i': index } as CSSProperties}
    >
      {children}
    </Tag>
  )
}
