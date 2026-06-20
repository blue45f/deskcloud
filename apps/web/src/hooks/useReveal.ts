import { useEffect, useRef } from 'react'

/**
 * 스크롤 리빌 — 요소가 뷰포트에 들어오면 `.is-in` 을 붙여 CSS `.reveal` 트랜지션을 재생한다.
 *
 * 설계 원칙(impeccable):
 * - 리빌은 "이미 보이는" 기본값을 강화한다. IntersectionObserver 가 없거나(헤드리스/SSR)
 *   prefers-reduced-motion 이면 즉시 `.is-in` 을 붙여 콘텐츠를 그대로 노출한다(빈 화면 금지).
 * - 한 번 보이면 관측을 해제한다(unobserve) — 스크롤 이벤트 리스너 미사용.
 *
 * @param once true(기본)면 첫 진입 후 더 이상 토글하지 않는다.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  once = true
): React.RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 관측 불가 환경 또는 모션 비선호 → 즉시 노출.
    if (reduce || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in')
      return
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            if (once) obs.unobserve(entry.target)
          } else if (!once) {
            entry.target.classList.remove('is-in')
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [once])

  return ref
}
