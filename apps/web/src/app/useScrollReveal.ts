import { useEffect, useRef } from 'react'

import type { RefObject } from 'react'

/**
 * 스크롤 리빌 — 컨테이너 안의 `[data-reveal]` 요소를 뷰포트 진입 시 한 번 드러낸다.
 *
 * 설계 원칙(과제 제약 준수):
 *  - **no-JS / no-CLS 안전**: 마크업 기본값은 "보임"이다. JS가 붙은 직후에만 `.ax-reveal-armed`
 *    로 잠깐 숨겼다가, 관찰되면 `.ax-revealed` 로 드러낸다. 스크립트가 실행되지 않으면 콘텐츠는
 *    그대로 보인다(빈 화면 없음).
 *  - **prefers-reduced-motion 존중**: 모션 축소 사용자는 arm 자체를 건너뛰어 즉시 표시한다.
 *  - **IntersectionObserver 미지원/부재**: 전부 즉시 드러낸다.
 *
 * 반환한 ref를 리빌 대상들의 공통 조상에 부착한다.
 */
export function useScrollReveal<T extends HTMLElement>(): RefObject<T | null> {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (targets.length === 0) return

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 모션 축소 또는 IO 미지원 → 즉시 표시(arm 안 함).
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('ax-revealed'))
      return
    }

    // JS 확인됨 → 잠깐 숨겼다가 관찰 시 드러낸다.
    targets.forEach((el) => el.classList.add('ax-reveal-armed'))

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('ax-revealed')
            obs.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return containerRef
}
