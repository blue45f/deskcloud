import { useEffect, useRef, useState } from 'react'

import type { RefObject } from 'react'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

function supportsObserver(): boolean {
  return typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function'
}

type RevealOptions = {
  /** 뷰포트 진입 임계값(0~1). */
  threshold?: number
  /** 하단 여백 — 살짝 일찍 트리거해 스크롤이 매끄럽게 보이게 한다. */
  rootMargin?: string
}

/**
 * 스크롤 진입 시 한 번만 `is-revealed`를 켜는 enhancement-only 훅.
 *
 * - 기본값은 "보임"이다. IO/모션 미지원·헤드리스·prefers-reduced-motion이면
 *   마운트 즉시 revealed로 처리해 콘텐츠가 절대 빈 채로 출하되지 않는다.
 * - 관찰은 한 번 발화 후 해제한다(스크롤 리스너 없음, 60fps 안전).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: RevealOptions = {}
): { ref: RefObject<T | null>; revealed: boolean } {
  const { threshold = 0, rootMargin = '0px 0px -6% 0px' } = options
  const ref = useRef<T | null>(null)
  const [revealed, setRevealed] = useState(() => !supportsObserver() || prefersReducedMotion())

  useEffect(() => {
    if (revealed) return
    const node = ref.current
    if (!node) {
      setRevealed(true)
      return
    }
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
      { threshold, rootMargin }
    )
    observer.observe(node)

    // 페일세이프 — IO가 어떤 이유로든 발화하지 않아도 콘텐츠가 영구히 숨지 않게,
    // 마운트 후 일정 시간 뒤 강제로 안착시킨다. 콘텐츠 가시성은 모션에 의존하지 않는다.
    const fallback = window.setTimeout(() => {
      setRevealed(true)
      observer.disconnect()
    }, 1600)

    return () => {
      observer.disconnect()
      window.clearTimeout(fallback)
    }
  }, [revealed, rootMargin, threshold])

  return { ref, revealed }
}
