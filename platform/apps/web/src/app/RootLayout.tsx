import { Outlet } from 'react-router-dom'

import RouteAnnouncer from '@/components/common/RouteAnnouncer'
import SkipLink from '@/components/common/SkipLink'
import { IntroSplashScreen } from '@/components/layout/IntroSplashScreen'

/** 루트 셸 — 스킵링크 + 라우트 변경 안내(스크린리더) + 페이지 아웃렛. */
export default function RootLayout() {
  return (
    <>
      <IntroSplashScreen />
      <SkipLink />
      <RouteAnnouncer />
      <Outlet />
    </>
  )
}
