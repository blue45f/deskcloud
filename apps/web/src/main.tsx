import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { ErrorBoundary } from '@/app/ErrorBoundary'
import { AuthProvider } from '@/lib/firebaseAuth'
import { router } from '@/router'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root element를 찾을 수 없습니다')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
)
