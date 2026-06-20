import { useEffect, useRef } from 'react'

/**
 * 스크롤 리빌 — 컨테이너 안의 `[data-reveal-target]` 요소를 뷰포트 진입 시 한 번만 드러낸다.
 *
 * 점진적 향상(progressive enhancement) 원칙:
 * - JSX 에는 `data-reveal-target` 마커만 둔다(스타일 영향 없음). 따라서 JS 가 없으면
 *   콘텐츠는 평범하게 그대로 보인다 — 빈 화면·blank-on-no-JS 가 발생하지 않는다.
 * - 이 훅이 마운트되면, 화면 밖 요소에만 `data-reveal=""`(숨김)을 부여하고 IntersectionObserver
 *   로 등장 시 `data-reveal="shown"` 으로 한 번만 드러낸 뒤 unobserve 한다. 이미 화면 안에 있는
 *   요소는 곧장 `shown` 으로 표시해 첫 페인트에서 깜빡임(flash-of-hidden)을 만들지 않는다.
 * - prefers-reduced-motion 이거나 IntersectionObserver 미지원이면 관찰 없이 전부 즉시 표시한다.
 *
 * CLS 방지: 리빌은 transform/opacity 만 바꾸며 레이아웃 박스 크기는 그대로다.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal-target]'))
    if (items.length === 0) return

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            ;(entry.target as HTMLElement).dataset.reveal = 'shown'
            obs.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    )

    const vh = window.innerHeight || document.documentElement.clientHeight
    for (const el of items) {
      const rect = el.getBoundingClientRect()
      const alreadyVisible = rect.top < vh * 0.9 && rect.bottom > 0
      // 첫 화면에 이미 보이는 요소는 숨기지 않고 즉시 등장 처리(깜빡임 방지).
      el.dataset.reveal = alreadyVisible ? 'shown' : ''
      if (!alreadyVisible) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  return ref
}
