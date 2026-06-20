import { Outlet } from 'react-router-dom'

import RouteAnnouncer from '@/components/common/RouteAnnouncer'
import SkipLink from '@/components/common/SkipLink'
import { useVisitPing } from '@/hooks/useVisitPing'

export default function RootLayout() {
  // 방문 추적 — 앱 부팅 시 1회 metrics ping(운영 현황 트래픽 지표). 실패는 무시.
  useVisitPing()
  return (
    <>
      <SkipLink />
      <RouteAnnouncer />
      <Outlet />
    </>
  )
}
