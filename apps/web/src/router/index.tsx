import { createBrowserRouter } from 'react-router-dom'

import type { ComponentType } from 'react'

import RequireAuth from '@/app/RequireAuth'
import RootLayout from '@/app/RootLayout'
import Loading from '@/components/common/Loading'
import RouteError from '@/components/common/RouteError'
import AppLayout from '@/components/layout/AppLayout'

const CHUNK_RETRY_KEY = 'searchdesk-chunk-retry'

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
      { index: true, lazy: lazyRetry(() => import('@/pages/LandingPage')) },
      // 라이브 디자인 시스템(스타일 가이드) — 공개.
      { path: 'design', lazy: lazyRetry(() => import('@/pages/DesignPage')) },
      { path: 'sitemap', lazy: lazyRetry(() => import('@/pages/SitemapPage')) },
      // 플랫폼 현황(트래픽·가입) — 공개·무인증.
      { path: 'status', lazy: lazyRetry(() => import('@/pages/StatusPage')) },
      { path: 'login', lazy: lazyRetry(() => import('@/pages/LoginPage')) },
      { path: 'signup', lazy: lazyRetry(() => import('@/pages/SignupPage')) },
      // 공개 위젯 데모 — 실제 ⌘K 팔레트·인라인 박스를 띄워 검색 체험.
      { path: 'demo', lazy: lazyRetry(() => import('@/pages/DemoPage')) },
      // 문의 게시판 — desk-platform 공개 API 로 문의 등록·공개 목록.
      { path: 'support', lazy: lazyRetry(() => import('@/pages/SupportPage')) },
      {
        path: 'app',
        Component: RequireAuth,
        children: [
          {
            Component: AppLayout,
            children: [
              { index: true, lazy: lazyRetry(() => import('@/pages/OverviewPage')) },
              { path: 'documents', lazy: lazyRetry(() => import('@/pages/DocumentsPage')) },
              { path: 'search', lazy: lazyRetry(() => import('@/pages/SearchTesterPage')) },
              { path: 'settings', lazy: lazyRetry(() => import('@/pages/SettingsPage')) },
              { path: 'embed', lazy: lazyRetry(() => import('@/pages/EmbedPage')) },
            ],
          },
        ],
      },
      { path: '*', lazy: lazyRetry(() => import('@/pages/NotFoundPage')) },
    ],
  },
])
