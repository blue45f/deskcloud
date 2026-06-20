import { createBrowserRouter } from 'react-router-dom'

import type { ComponentType } from 'react'

import RequireAuth from '@/app/RequireAuth'
import RootLayout from '@/app/RootLayout'
import Loading from '@/components/common/Loading'
import RouteError from '@/components/common/RouteError'
import AppLayout from '@/components/layout/AppLayout'
import PublicLayout from '@/components/layout/PublicLayout'

const CHUNK_RETRY_KEY = 'deskcloud-chunk-retry'

/**
 * 라우트별 코드 분할 — 각 페이지를 별도 청크로. 배포 직후 stale 청크 404 는
 * 새로고침 1회로 자동 복구(sessionStorage 가드, 성공 로드 시에만 해제).
 */
const lazyRetry =
  <T extends ComponentType>(factory: () => Promise<{ default: T }>) =>
  async (): Promise<{ Component: T }> => {
    try {
      const mod = await factory()
      sessionStorage.removeItem(CHUNK_RETRY_KEY)
      return { Component: mod.default }
    } catch (err) {
      if (!sessionStorage.getItem(CHUNK_RETRY_KEY)) {
        sessionStorage.setItem(CHUNK_RETRY_KEY, '1')
        window.location.reload()
        return new Promise<never>(() => {})
      }
      throw err
    }
  }

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RouteError,
    HydrateFallback: Loading,
    children: [
      // 공개(마케팅·온보딩) — 상단바/푸터가 있는 셸.
      {
        Component: PublicLayout,
        children: [
          { index: true, lazy: lazyRetry(() => import('@/pages/LandingPage')) },
          { path: 'catalog', lazy: lazyRetry(() => import('@/pages/CatalogPage')) },
          { path: 'pricing', lazy: lazyRetry(() => import('@/pages/PricingPage')) },
          { path: 'docs', lazy: lazyRetry(() => import('@/pages/DocsPage')) },
          { path: 'signup', lazy: lazyRetry(() => import('@/pages/SignupPage')) },
          { path: 'login', lazy: lazyRetry(() => import('@/pages/LoginPage')) },
        ],
      },
      // 라이브 스타일 가이드 — 자체 헤더를 가짐(공개).
      { path: 'design', lazy: lazyRetry(() => import('@/pages/DesignPage')) },
      { path: 'sitemap', lazy: lazyRetry(() => import('@/pages/SitemapPage')) },
      // 어드민 문의 보드 — 자체 헤더(공개 라우트, 데이터는 X-Admin-Token 으로 보호).
      { path: 'admin/inquiries', lazy: lazyRetry(() => import('@/pages/AdminInquiriesPage')) },
      // 콘솔 — secret 키 필요.
      {
        path: 'dashboard',
        Component: RequireAuth,
        children: [
          {
            Component: AppLayout,
            children: [{ index: true, lazy: lazyRetry(() => import('@/pages/DashboardPage')) }],
          },
        ],
      },
      { path: '*', lazy: lazyRetry(() => import('@/pages/NotFoundPage')) },
    ],
  },
])
