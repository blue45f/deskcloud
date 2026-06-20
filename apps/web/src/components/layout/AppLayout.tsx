import { LogOut, Moon, Sun } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useSessionStore } from '@/app/sessionStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/utils/cn'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/app', label: '대시보드', end: true },
  { to: '/app/templates', label: '템플릿' },
  { to: '/app/sent', label: '발송 로그' },
  { to: '/app/inbox', label: '인박스 프리뷰' },
  { to: '/app/settings', label: '설정' },
  { to: '/app/embed', label: '임베드' },
  { to: '/support', label: '문의' },
]

function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      onClick={toggle}
      aria-label={resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {resolved === 'dark' ? (
        <Sun className="size-[1.05rem]" />
      ) : (
        <Moon className="size-[1.05rem]" />
      )}
    </Button>
  )
}

/** 어드민 셸 — 상단바(브랜드·내비·테마·로그아웃) + 본문 컨테이너. */
export default function AppLayout() {
  const navigate = useNavigate()
  const clear = useSessionStore((s) => s.clear)
  const session = useSessionStore((s) => s.session)

  const logout = () => {
    clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <NavLink to="/app" className="shrink-0" aria-label="NotifyDesk 대시보드">
            <Brand />
          </NavLink>

          <nav aria-label="주요" className="ml-2 flex items-center gap-0.5 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-accent-soft text-accent-fg'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text'
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Tooltip
              content={
                session.kind === 'admin'
                  ? `플랫폼 어드민 · tenantId ${session.tenantId}`
                  : 'secret 키(sk_) 세션'
              }
            >
              <span className="hidden md:inline">
                <Badge tone={session.kind === 'admin' ? 'warning' : 'outline'} size="sm">
                  {session.kind === 'admin' ? 'ADMIN_TOKEN' : 'sk_ 세션'}
                </Badge>
              </span>
            </Tooltip>
            <ThemeToggle />
            <Tooltip content="세션을 지우고 로그아웃합니다">
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="size-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            </Tooltip>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-8 outline-none sm:px-6"
      >
        <Outlet />
      </main>
    </div>
  )
}
