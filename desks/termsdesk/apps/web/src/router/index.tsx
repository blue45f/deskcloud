import { createBrowserRouter } from 'react-router-dom'

import type { ComponentType } from 'react'

import RequireAuth from '@/app/RequireAuth'
import RootLayout from '@/app/RootLayout'
import Loading from '@/components/common/Loading'
import RouteError from '@/components/common/RouteError'

const CHUNK_RETRY_KEY = 'termsdesk-chunk-retry'

/**
 * 라우트별 코드 분할 — 각 페이지(+해당 페이지 전용 의존성)를 별도 청크로.
 *
 * 배포 직후 stale 청크 404(새 배포로 이전 해시 파일이 사라진 경우)는 새로고침 1회로
 * 자동 복구한다. 가드는 sessionStorage 라 reload 너머로 유지되고, '성공 로드 시'에만
 * 해제한다(즉시 해제하면 무한 reload 루프 위험). 두 번째 실패는 throw 되어
 * RouteError(ErrorBoundary)로 노출된다.
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
        globalThis.location.reload()
        // reload 가 완료될 때까지 라우터를 멈춰 둔다(에러 화면 깜빡임 방지).
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
      // 라이브 디자인 시스템(스타일 가이드) — 공개, 인증 불필요. 푸터에서만 노출.
      { path: 'design', lazy: lazyRetry(() => import('@/pages/DesignPage')) },
      { path: 'sitemap', lazy: lazyRetry(() => import('@/pages/SitemapPage')) },
      { path: 'login', lazy: lazyRetry(() => import('@/pages/LoginPage')) },
      { path: 'register', lazy: lazyRetry(() => import('@/pages/RegisterPage')) },
      // 공개(인증 없음) 약관 페이지 — 푸터 링크/팝업/iframe 대상.
      { path: 'p/:orgSlug/:slug', lazy: lazyRetry(() => import('@/pages/PublicPolicyPage')) },
      { path: 'experts', lazy: lazyRetry(() => import('@/pages/PublicExpertsPage')) },
      { path: 'experts/:id', lazy: lazyRetry(() => import('@/pages/PublicExpertProfilePage')) },
      { path: 'support/:projectSlug', lazy: lazyRetry(() => import('@/pages/SupportPage')) },
      {
        path: 'app',
        Component: RequireAuth,
        children: [
          { index: true, lazy: lazyRetry(() => import('@/pages/DashboardPage')) },
          { path: 'policies', lazy: lazyRetry(() => import('@/pages/PoliciesPage')) },
          { path: 'policies/:slug', lazy: lazyRetry(() => import('@/pages/PolicyDetailPage')) },
          {
            path: 'policies/:slug/versions/new',
            lazy: lazyRetry(() => import('@/pages/VersionEditorPage')),
          },
          {
            path: 'versions/:versionId',
            lazy: lazyRetry(() => import('@/pages/VersionDetailPage')),
          },
          {
            path: 'versions/:versionId/edit',
            lazy: lazyRetry(() => import('@/pages/VersionEditorPage')),
          },
          { path: 'consents', lazy: lazyRetry(() => import('@/pages/ConsentsPage')) },
          {
            path: 'consents/:subjectRef',
            lazy: lazyRetry(() => import('@/pages/SubjectHistoryPage')),
          },
          { path: 'inquiries', lazy: lazyRetry(() => import('@/pages/InquiriesPage')) },
          // 약관 의뢰 중계(브로커리지) — 의뢰자/전문가/운영자 흐름.
          { path: 'requests', lazy: lazyRetry(() => import('@/pages/RequestsPage')) },
          { path: 'requests/:id', lazy: lazyRetry(() => import('@/pages/RequestDetailPage')) },
          { path: 'marketplace', lazy: lazyRetry(() => import('@/pages/MarketplacePage')) },
          { path: 'expert', lazy: lazyRetry(() => import('@/pages/ExpertProfilePage')) },
          { path: 'moderation', lazy: lazyRetry(() => import('@/pages/ModerationPage')) },
          { path: 'audit', lazy: lazyRetry(() => import('@/pages/AuditPage')) },
          { path: 'api-keys', lazy: lazyRetry(() => import('@/pages/ApiKeysPage')) },
          { path: 'demo', lazy: lazyRetry(() => import('@/pages/DemoPage')) },
          { path: 'guide', lazy: lazyRetry(() => import('@/pages/IntegrationGuidePage')) },
          { path: 'admin', lazy: lazyRetry(() => import('@/pages/AdminPage')) },
          { path: 'settings', lazy: lazyRetry(() => import('@/pages/SettingsPage')) },
        ],
      },
      { path: '*', lazy: lazyRetry(() => import('@/pages/NotFoundPage')) },
    ],
  },
])
