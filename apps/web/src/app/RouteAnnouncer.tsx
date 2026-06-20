import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import type { ReactElement } from 'react'

/**
 * RouteAnnouncer — SPA 라우트 전환을 스크린리더에 알린다.
 *
 * 클라이언트 사이드 네비게이션은 전체 페이지 리로드가 없어 보조기술 사용자가
 * "페이지가 바뀌었다"는 사실을 인지하지 못한다. 시각적으로 숨겨진 aria-live 영역에
 * 새 document.title을 announce 한다. 포커스 이동은 AppLayout이 담당하므로 여기서는
 * 알림만 처리한다(역할 분리). 첫 페인트는 건너뛴다(이미 사용자가 보는 화면).
 *
 * 각 페이지의 useDocumentTitle effect가 title을 갱신하므로, 한 프레임 뒤에 읽어
 * 직전 페이지가 아닌 새 페이지 제목을 캡처한다. 시각적 출력이 없어 레이아웃에
 * 영향을 주지 않는다.
 */
export function RouteAnnouncer(): ReactElement {
  const { pathname } = useLocation()
  const [message, setMessage] = useState('')
  const isInitialRender = useRef(true)

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }
    if (typeof window === 'undefined') return

    const rafId = window.requestAnimationFrame(() => {
      const title = document.title.trim()
      setMessage(title ? `${title} 페이지로 이동했습니다` : '페이지로 이동했습니다')
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [pathname])

  return (
    <div className="ax-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
