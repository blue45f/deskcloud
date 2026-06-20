import { useEffect, useState } from 'react'

/**
 * 페이지가 임계값(기본 8px)보다 아래로 스크롤됐는지 추적한다.
 * 스티키 헤더의 "스크롤 시 떠오름"(그림자·테두리 강조) 같은 미세 전환에 쓴다.
 *
 * - rAF 로 스크롤 핸들러를 코얼레싱해 레이아웃 스래싱을 피한다.
 * - passive 리스너 + 마운트 시 초기 동기화(새로고침 후 중간 위치 복원 대비).
 * - SSR/관찰 불가 환경에서도 안전(window 가드).
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let raf = 0
    const read = (): void => {
      raf = 0
      setScrolled(window.scrollY > threshold)
    }
    const onScroll = (): void => {
      if (raf === 0) raf = requestAnimationFrame(read)
    }
    read() // 초기 위치 동기화
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [threshold])

  return scrolled
}
