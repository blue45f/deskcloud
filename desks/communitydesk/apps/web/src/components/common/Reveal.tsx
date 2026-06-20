import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

import { cn } from '@/utils/cn'

interface RevealProps {
  children: ReactNode
  /** 시맨틱 래퍼 태그 (기본 div). 섹션 진입엔 'section' 등을 넘긴다. */
  as?: ElementType
  /** 스태거 지연(ms) — 같은 그룹 내 순차 등장. */
  delay?: number
  className?: string
  /** 한 번 보이면 계속 보임(기본 true). */
  once?: boolean
}

/**
 * 스크롤 리빌 래퍼 — 뷰포트에 들어오면 살짝 떠오르며 페이드 인.
 *
 * 핵심 안전장치:
 *  - 콘텐츠는 **항상 DOM 에 렌더**된다(가시성만 트랜지션). 헤드리스 렌더·검색
 *    봇·JS 비활성 어디서도 빈 화면이 되지 않는다.
 *  - IntersectionObserver 미지원이거나 관찰이 끝내 발화하지 않으면 **즉시 표시**.
 *  - prefers-reduced-motion 은 CSS(`[data-reveal]` 미디어쿼리)에서 트랜지션을
 *    제거 — 여기선 관성적으로 is-in 을 붙여도 시각적으로 점프하지 않는다.
 */
export function Reveal({ children, as, delay = 0, className, once = true }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // 관찰 불가 환경(서버/봇/구형) → 다음 프레임에 즉시 표시.
    // (effect 본문에서 동기 setState 를 피하려 rAF 로 디퍼한다.)
    if (typeof IntersectionObserver === 'undefined') {
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            if (once) obs.disconnect()
          } else if (!once) {
            setShown(false)
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    )
    obs.observe(el)

    // 안전 폴백 — 어떤 이유로든 관찰이 발화하지 않으면 1.2s 뒤 강제 표시.
    const fallback = window.setTimeout(() => setShown(true), 1200)

    return () => {
      obs.disconnect()
      window.clearTimeout(fallback)
    }
  }, [once])

  return (
    <Tag
      ref={ref}
      data-reveal
      className={cn(shown && 'is-in', className)}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  )
}
