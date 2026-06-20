import { Outlet } from 'react-router-dom'

import RouteAnnouncer from '@/components/common/RouteAnnouncer'
import SkipLink from '@/components/common/SkipLink'

export default function RootLayout() {
  return (
    <>
      <SkipLink />
      <RouteAnnouncer />
      <Outlet />
    </>
  )
}
