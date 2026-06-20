import { useEffect, useRef, useState } from 'react'

/** SSR/구형 환경 안전: reduced-motion 또는 IO 미지원이면 처음부터 가시(true)로 시작한다. */
function shouldStartRevealed(): boolean {
  if (typeof window === 'undefined') return true
  if (typeof IntersectionObserver === 'undefined') return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * 스크롤 리빌 훅 — 요소가 뷰포트에 들어오면 한 번 `revealed=true` 로 전환한다.
 * IntersectionObserver 로 구현하며, 한 번 보이면 관찰을 끊어(re-trigger 없음) 깜빡임을 막는다.
 *
 * 접근성: `prefers-reduced-motion: reduce` 이거나 IO 미지원이면 초기 상태부터 `revealed=true`
 * 로 폴백해 콘텐츠가 즉시 보이게 한다(모션 없이도 레이아웃·가독성 동일). 폴백은 초기화 함수에서
 * 결정하므로 effect 안에서 동기 setState 캐스케이드가 발생하지 않는다.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  /** 0–1. 이 비율만큼 보이면 리빌. 기본 0.15. */
  threshold?: number
  /** 뷰포트 하단을 미리 당겨 더 일찍 트리거. 기본 '0px 0px -10% 0px'. */
  rootMargin?: string
}) {
  const ref = useRef<T>(null)
  // 초기화 함수에서 reduced-motion/미지원을 판정 → 그 경우 관찰 없이 바로 가시.
  const [revealed, setRevealed] = useState(shouldStartRevealed)

  useEffect(() => {
    const node = ref.current
    if (!node || revealed) return

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
        threshold: options?.threshold ?? 0.15,
        rootMargin: options?.rootMargin ?? '0px 0px -10% 0px',
      }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [options?.threshold, options?.rootMargin, revealed])

  return { ref, revealed }
}
