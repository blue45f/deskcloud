import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 라우트 변경 시: 본문(main)으로 포커스 이동 + 상단 스크롤 + 스크린리더 안내 메시지 생성.
 * 페이지가 document.title 을 세팅할 한 프레임을 기다린 뒤 안내(stale 방지).
 */
export function useRouteAnnouncer(): string {
  const { pathname } = useLocation()
  const [message, setMessage] = useState('')
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const frame = requestAnimationFrame(() => {
      const title = document.title.trim()
      setMessage(title ? `${title} 페이지로 이동했습니다` : '페이지가 변경되었습니다')

      const main = document.getElementById('main-content')
      main?.focus({ preventScroll: true })

      const reduce =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return message
}
