import { useEffect, useRef } from 'react'

/**
 * 스크롤 인 리빌 — 요소가 뷰포트에 들어오면 `data-revealed` 를 붙여
 * CSS 전환(styles/index.css 의 `[data-reveal]`)을 트리거한다.
 *
 * 설계 의도:
 * - 콘텐츠는 항상 DOM 에 존재(레이아웃 점유) → CLS 0.
 * - 관찰자가 없거나(SSR) reduced-motion 이면 CSS 가 즉시 가시 상태를 보장한다.
 * - 한 번 드러나면 관찰을 끊어 재실행/깜빡임을 막는다.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number
  rootMargin?: string
  once?: boolean
}) {
  const ref = useRef<T>(null)
  const { threshold = 0.16, rootMargin = '0px 0px -8% 0px', once = true } = options ?? {}

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // 관찰자 미지원 환경: 즉시 노출.
    if (typeof IntersectionObserver === 'undefined') {
      el.setAttribute('data-revealed', '')
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', '')
            if (once) observer.unobserve(entry.target)
          } else if (!once) {
            entry.target.removeAttribute('data-revealed')
          }
        }
      },
      { threshold, rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return ref
}
