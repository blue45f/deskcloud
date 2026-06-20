import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { ErrorBoundary } from '@/app/ErrorBoundary'
import { AuthProvider } from '@/lib/firebaseAuth'
import { router } from '@/router'
import { trackVisitOncePerDay } from '@/services/visitTracker'
import '@/styles/index.css'

// 방문 핑(브라우저/일 1회) — 운영 현황 패널의 '오늘 방문자 수' 를 정직하게 채운다.
// fire-and-forget: 실패해도 앱 렌더링에는 영향이 없다.
trackVisitOncePerDay()

const root = document.getElementById('root')
if (!root) throw new Error('#root element를 찾을 수 없습니다')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      {/* 통합 회원 로그인(Firebase Auth) — 앱 루트에 1회 마운트. env 미설정이면 친절히 degrade. */}
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
)
