import { type CSSProperties, type ElementType, type ReactNode } from 'react'

import { useReveal } from '@/hooks/useReveal'

interface RevealProps {
  children: ReactNode
  /** 진입 지연(ms) — 같은 줄의 카드들을 순차적으로 드러낼 때(스태거). */
  delay?: number
  className?: string
  /** 렌더 태그(기본 div). 시맨틱 섹션엔 'section' 등을 넘긴다. */
  as?: ElementType
  style?: CSSProperties
}

/**
 * 스크롤 진입 시 부드럽게 등장하는 래퍼. 콘텐츠는 항상 레이아웃을 점유하므로 CLS 가 없고,
 * reduced-motion/SSR 에선 즉시 가시 상태가 된다(useReveal + [data-reveal] CSS).
 */
export function Reveal({ children, delay = 0, className, as, style }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useReveal<HTMLElement>()
  return (
    <Tag
      ref={ref}
      data-reveal=""
      className={className}
      style={{ ...style, ...(delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : {}) }}
    >
      {children}
    </Tag>
  )
}
