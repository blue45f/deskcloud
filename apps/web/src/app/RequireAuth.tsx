import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useSessionStore } from './sessionStore'

/**
 * 어드민 게이트 — secret 키(또는 마스터 토큰)가 클라이언트에 저장돼 있어야 /app/* 접근 가능.
 * 없으면 /login 으로(원래 가려던 곳을 state.from 으로 기억).
 */
export default function RequireAuth() {
  const isAuthed = useSessionStore((s) => s.isAuthed)
  const location = useLocation()

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}
