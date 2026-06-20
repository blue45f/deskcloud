import { useEffect, useRef } from 'react'

/**
 * 스크롤 리빌 — 컨테이너 안의 `.reveal` 요소가 뷰포트에 들어오면 `.is-in` 을 붙여
 * CSS 트랜지션을 한 번만 재생한다. 발화 후 unobserve 한다.
 *
 * 설계 메모(블랭크/CLS 절대 방지):
 * - 콘텐츠 가시성은 절대 JS 에 의존하지 않는다. `.reveal` 초기값은 CSS 가 정하고,
 *   reduced-motion·no-js 폴백이 최종 상태를 보장한다.
 * - reduced-motion·IO 미지원이면 즉시 전부 확정한다.
 * - **안전 타이머**: 1.2s 안에 관찰이 못 붙은(빠른 점프 스크롤·백그라운드 탭·헤드리스
 *   캡처·프린트) 잔여 요소는 강제로 `.is-in` 처리한다 → 섹션이 빈 채로 남지 않는다.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const items = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (items.length === 0) return

    const revealAll = () => items.forEach((el) => el.classList.add('is-in'))

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      revealAll()
      return
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            obs.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    )

    items.forEach((el) => observer.observe(el))

    // 안전망 — 어떤 이유로든 관찰이 못 끝나면 잔여 요소를 확정해 빈 섹션을 막는다.
    const fallback = window.setTimeout(revealAll, 1200)

    return () => {
      window.clearTimeout(fallback)
      observer.disconnect()
    }
  }, [])

  return ref
}
