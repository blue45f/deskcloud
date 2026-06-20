import { useEffect, useState } from 'react'

/**
 * 페이지가 임계값(기본 8px) 이상 스크롤됐는지. 스티키 헤더의 엘리베이션
 * (그림자·보더 강조) 전환에 쓴다. passive 리스너 + 초기 1회 측정.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return scrolled
}
