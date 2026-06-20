import { createBrowserRouter } from 'react-router-dom'

import type { ComponentType } from 'react'

import RequireAuth from '@/app/RequireAuth'
import RootLayout from '@/app/RootLayout'
import Loading from '@/components/common/Loading'
import RouteError from '@/components/common/RouteError'
import AppLayout from '@/components/layout/AppLayout'

const CHUNK_RETRY_KEY = 'notifydesk-chunk-retry'

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
      { path: 'login', lazy: lazyRetry(() => import('@/pages/LoginPage')) },
      { path: 'signup', lazy: lazyRetry(() => import('@/pages/SignupPage')) },
      // 공개 위젯 데모 — 실제 알림 벨을 띄워 인박스 체험.
      { path: 'demo', lazy: lazyRetry(() => import('@/pages/DemoPage')) },
      // 공개 문의 게시판 — desk-platform 공개 API 로 등록·조회.
      { path: 'support', lazy: lazyRetry(() => import('@/pages/SupportPage')) },
      {
        path: 'app',
        Component: RequireAuth,
        children: [
          {
            Component: AppLayout,
            children: [
              { index: true, lazy: lazyRetry(() => import('@/pages/DashboardPage')) },
              { path: 'templates', lazy: lazyRetry(() => import('@/pages/TemplatesPage')) },
              { path: 'sent', lazy: lazyRetry(() => import('@/pages/SentLogPage')) },
              { path: 'inbox', lazy: lazyRetry(() => import('@/pages/InboxPreviewPage')) },
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
