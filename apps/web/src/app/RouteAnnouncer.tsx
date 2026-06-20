import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import type { ReactElement } from 'react'

/**
 * 라우트 전환 announcer.
 *
 * SPA 는 전체 문서 로드 없이 콘텐츠만 교체하므로, 다중 페이지 사이트라면 무료로 따라오는
 * "페이지가 바뀌었다"는 신호를 스크린리더가 받지 못한다. 이 컴포넌트는 시각적으로 숨겨진
 * aria-live 영역에 새 document.title 을 announce 해 보조기술 사용자에게 전환을 알린다.
 * (포커스 이동·스크롤 톱은 AppLayout 이 담당하므로 여기서는 announce 만 한다.)
 *
 * 첫 페인트에서는 announce 하지 않는다 — 사용자는 이미 그 페이지에 있다.
 * 라우트 제목 effect 가 먼저 돌도록 한 프레임 뒤에 title 을 읽는다.
 */
export function RouteAnnouncer(): ReactElement {
  const { pathname } = useLocation()
  const [message, setMessage] = useState('')
  const isInitial = useRef(true)

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false
      return
    }
    const id = window.requestAnimationFrame(() => {
      const title = document.title.trim()
      setMessage(title ? `${title} 페이지로 이동했습니다` : '페이지가 변경되었습니다')
    })
    return () => window.cancelAnimationFrame(id)
  }, [pathname])

  return (
    <div className="fd-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
