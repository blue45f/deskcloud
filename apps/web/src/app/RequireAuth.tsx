import { Navigate, useLocation } from 'react-router-dom'

import { useSecretKey } from './useSession'

import type { ReactElement, ReactNode } from 'react'

/** secret 키가 없으면 로그인으로 보낸다(보호 라우트). */
export function RequireAuth({ children }: { children: ReactNode }): ReactElement {
  const secretKey = useSecretKey()
  const location = useLocation()
  if (!secretKey) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
