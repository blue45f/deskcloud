import { Outlet } from 'react-router-dom'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'

/** 공개(마케팅·온보딩) 페이지 셸 — 상단바 + 본문 + 푸터. */
export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
