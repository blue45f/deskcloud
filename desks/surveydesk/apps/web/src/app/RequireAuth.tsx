import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAdminStore } from './adminStore'

/**
 * 어드민 게이트 — ADMIN_TOKEN 이 클라이언트에 저장돼 있어야 /app/* 에 접근 가능.
 * 없으면 /login 으로(원래 가려던 곳을 state.from 으로 기억).
 */
export default function RequireAuth() {
  const isAuthed = useAdminStore((s) => s.isAuthed)
  const location = useLocation()

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}
