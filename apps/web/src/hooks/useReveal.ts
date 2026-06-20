import { useEffect } from 'react'

/**
 * 스크롤 리빌 — `[data-reveal]` 요소가 뷰포트에 들어오면 `.is-visible` 을 붙여
 * "가라앉았다가 올라오는" 연출을 켠다(스타일은 index.css).
 *
 * 안전 원칙:
 * - 콘텐츠는 기본적으로 보인다. 마운트 시에만 <html> 에 `.js-reveal` 을 붙여
 *   숨김→등장 연출을 활성화하므로 no-JS·SSR·봇 환경에서 빈 화면이 없다(no-CLS).
 * - IntersectionObserver 미지원/실패 시 모든 대상을 즉시 표시한다(graceful).
 * - prefers-reduced-motion 은 CSS 가 전역으로 무력화한다(여기선 분기 불필요).
 *
 * 마운트 시 1회 스캔한다(랜딩의 리빌 대상은 정적). 동적 목록에는 적합하지 않다.
 */
export function useReveal(): void {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('js-reveal')

    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (targets.length === 0) return

    // IntersectionObserver 미지원 → 전부 즉시 표시.
    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            obs.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    )

    targets.forEach((el) => {
      // 이미 뷰포트 위쪽(스크롤 지나친)이면 즉시 표시.
      if (el.getBoundingClientRect().top < window.innerHeight) {
        el.classList.add('is-visible')
      } else {
        observer.observe(el)
      }
    })

    return () => observer.disconnect()
  }, [])
}
