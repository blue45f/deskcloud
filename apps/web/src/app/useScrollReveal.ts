import { useEffect, useRef } from 'react'

import type { RefObject } from 'react'

/**
 * 스크롤 진입 시 `[data-reveal]` 요소를 한 번씩 드러내는 훅.
 *
 * 설계 원칙(impeccable):
 *  - **콘텐츠는 기본적으로 보인다.** reveal 은 *이미 보이는* 기본을 강화할 뿐이다.
 *    JS 가 살아 있고 모션이 허용될 때만 컨테이너에 `is-reveal-armed` 를 붙여
 *    진입 전 상태(opacity:0)로 내린다 → headless/비-JS/탭 백그라운드에서 빈 화면이 안 생긴다.
 *  - `prefers-reduced-motion` 이면 아예 무장하지 않는다(즉시 표시, 트랜지션 0).
 *  - IntersectionObserver 미지원이면 모두 즉시 표시.
 *  - CLS 0: transform/opacity 만 사용, 레이아웃 속성은 건드리지 않는다.
 *
 * 반환된 ref 를 reveal 대상들을 감싸는 컨테이너에 단다.
 */
export function useScrollReveal<T extends HTMLElement>(): RefObject<T | null> {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      // 무장하지 않음 → 모든 콘텐츠가 정적으로 보인 채 유지된다.
      return
    }

    // JS·모션 모두 가능 → 진입 전 상태로 무장.
    container.classList.add('is-reveal-armed')
    const targets = Array.from(container.querySelectorAll<HTMLElement>('[data-reveal]'))

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            obs.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )

    for (const target of targets) observer.observe(target)

    // 안전망: 일정 시간 뒤에도 화면에 남아있는 무장 요소가 있으면 강제로 드러낸다
    // (관찰 누락·즉시 가시 상태 등에서 영구 숨김 방지).
    const safety = window.setTimeout(() => {
      for (const target of targets) target.classList.add('is-in')
    }, 1200)

    return () => {
      window.clearTimeout(safety)
      observer.disconnect()
    }
  }, [])

  return containerRef
}
