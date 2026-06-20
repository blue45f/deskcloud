import { useEffect, useState } from 'react'

/**
 * 스크롤 임계값 통과 여부 — 헤더가 "떠 있는" 상태로 전환될 때(그림자·테두리 강화)
 * 쓴다. 초기값은 현재 스크롤 위치를 즉시 반영해, 새로고침 후 스크롤된 상태에서도
 * 헤더가 올바르게 그려진다(깜빡임·불일치 없음).
 *
 * - passive 리스너로 스크롤 성능에 영향 주지 않는다.
 * - SSR/no-window 환경에선 false 로 시작하고, 마운트 시 한 번 동기화한다.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(
    () => typeof window !== 'undefined' && window.scrollY > threshold
  )

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll() // 마운트 시 현재 위치와 동기화
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return scrolled
}
