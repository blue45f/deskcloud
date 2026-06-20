import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import type { ReactElement } from 'react'

/**
 * 라우트 변경 announce(스크린리더용).
 *
 * SPA 는 전체 문서 로드 없이 내용만 바꾸므로, 멀티페이지에서 "공짜로" 따라오던
 * 페이지 전환 안내가 조용히 사라진다. 스크린리더 사용자는 `<title>` 변경을 듣지
 * 못하고 이전 컨텍스트에 갇힌다.
 *
 * 이 컴포넌트는 보이지 않는 aria-live="polite" 영역에 새 document.title 을 흘려보내
 * 그 문제만 추가적으로(어느 페이지도 건드리지 않고) 해결한다. 포커스 이동은 이미
 * AppLayout 이 `<main id="main">` 로 처리하므로 여기서는 announce 만 담당한다.
 *
 * AppLayout 안에 한 번만 마운트한다.
 */
export function RouteAnnouncer(): ReactElement {
  const { pathname } = useLocation()
  const [message, setMessage] = useState('')
  const isInitialRender = useRef(true)

  useEffect(() => {
    // 첫 페인트에서는 announce 하지 않는다 — 사용자는 이미 기대한 위치에 있다.
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }

    // 한 프레임 기다려 목적지 페이지의 useDocumentTitle 효과가 document.title 을
    // 먼저 갱신하게 한다(이전 페이지 제목이 아닌 새 제목을 읽기 위해).
    const rafId = window.requestAnimationFrame(() => {
      const title = document.title.trim()
      setMessage(title ? `${title} 페이지로 이동했습니다` : '페이지로 이동했습니다')
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [pathname])

  return (
    <div aria-live="polite" aria-atomic="true" className="ad-visually-hidden" data-route-announcer>
      {message}
    </div>
  )
}
