import { Outlet } from 'react-router-dom'

import RouteAnnouncer from '@/components/common/RouteAnnouncer'
import SkipLink from '@/components/common/SkipLink'
import { useVisitPing } from '@/hooks/useVisitPing'

export default function RootLayout() {
  // 운영 트래픽 집계 — 앱 로드 시 하루 1회 공개 방문 핑(fire-and-forget).
  useVisitPing()
  return (
    <>
      <SkipLink />
      <RouteAnnouncer />
      <Outlet />
    </>
  )
}
