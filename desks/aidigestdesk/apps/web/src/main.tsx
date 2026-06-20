import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/app/App'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { AuthProvider } from '@/lib/firebaseAuth'
import { ToastProvider } from '@/lib/toast'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root element를 찾을 수 없습니다')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
)

// PWA 서비스 워커 등록 — 프로덕션에서만(dev HMR과 충돌 방지).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 등록 실패는 비치명적 — 앱은 정상 동작한다.
    })
  })
}
