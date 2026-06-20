import { useEffect, useState } from 'react'

/**
 * 윈도 스크롤이 임계값(기본 8px)을 넘었는지 — 스티키 헤더 상태 토글용.
 * passive 리스너 + rAF 코얼레싱으로 메인스레드 부담 없이 동작한다.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let frame = 0
    const read = (): void => {
      frame = 0
      setScrolled(window.scrollY > threshold)
    }
    const onScroll = (): void => {
      if (frame === 0) frame = window.requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [threshold])

  return scrolled
}
