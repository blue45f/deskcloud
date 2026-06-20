import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

import RouteAnnouncer from '@/components/common/RouteAnnouncer'
import SkipLink from '@/components/common/SkipLink'
import { trackPageVisit } from '@/services/searchdesk'

/** 탭 세션당 1회만 방문 핑(서버 sd_vid 쿠키가 일자별 고유 방문자 판정을 담당). */
const VISIT_PING_KEY = 'searchdesk-visit-pinged'

export default function RootLayout() {
  useEffect(() => {
    if (sessionStorage.getItem(VISIT_PING_KEY)) return
    sessionStorage.setItem(VISIT_PING_KEY, '1')
    trackPageVisit()
  }, [])

  return (
    <>
      <SkipLink />
      <RouteAnnouncer />
      <Outlet />
    </>
  )
}
