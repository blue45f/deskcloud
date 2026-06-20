import { Outlet } from 'react-router-dom'

import RouteAnnouncer from '@/components/common/RouteAnnouncer'
import SkipLink from '@/components/common/SkipLink'
import { ChangelogLauncher } from '@/components/deskcloud/changelog/ChangelogLauncher'

export default function RootLayout() {
  return (
    <>
      <SkipLink />
      <RouteAnnouncer />
      <Outlet />
      {/* ChangelogDesk 네이티브 '변경 이력' 통합 — VITE_CHANGELOGDESK_URL 설정 시에만 렌더(미설정=영향 없음). */}
      <ChangelogLauncher />
    </>
  )
}
