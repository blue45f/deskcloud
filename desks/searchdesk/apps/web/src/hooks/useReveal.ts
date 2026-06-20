import { useEffect, useRef, useState } from 'react'

/**
 * 스크롤 리빌 — 요소가 뷰포트에 들어오면 한 번만 `revealed`를 true 로 만든다.
 * 반환한 ref 를 `.reveal` 요소에 달고, revealed 면 `.is-revealed` 를 붙여 등장시킨다.
 *
 * - IntersectionObserver 미지원/SSR/`prefers-reduced-motion` 환경에선 즉시 노출(점프 방지).
 * - 한 번 노출되면 관찰을 끊어 재진입 시 깜빡임이 없다(CLS 0 — 레이아웃 공간은 항상 점유).
 *
 * 마운트 시 1회 결정 — reduced-motion 이거나 IO 미지원이면 처음부터 노출(동기 setState 회피).
 */
function initiallyRevealed(): boolean {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  rootMargin?: string
  threshold?: number
}): { ref: React.RefObject<T | null>; revealed: boolean } {
  const ref = useRef<T>(null)
  // lazy 초기화 — reduced-motion/SSR/미지원이면 즉시 true 로 시작(effect 내 동기 setState 없음).
  const [revealed, setRevealed] = useState(initiallyRevealed)

  useEffect(() => {
    const el = ref.current
    // 이미 노출(reduced-motion/미지원) 상태면 관찰 불필요.
    if (!el || revealed || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true)
            observer.disconnect()
            break
          }
        }
      },
      {
        rootMargin: options?.rootMargin ?? '0px 0px -10% 0px',
        threshold: options?.threshold ?? 0.15,
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [options?.rootMargin, options?.threshold, revealed])

  return { ref, revealed }
}
