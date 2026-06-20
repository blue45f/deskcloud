import { LogOut, Moon, Sun } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuthStore } from '@/app/authStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useScrolled } from '@/hooks/useScrolled'
import { cn } from '@/utils/cn'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/app', label: '검수 대시보드', end: true },
  { to: '/app/testimonials', label: '후기 큐레이션' },
  { to: '/app/settings', label: '테넌트 설정' },
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

/** 어드민 셸 — 상단바(브랜드·내비·자격모드·테마·로그아웃) + 본문 컨테이너. */
export default function AppLayout() {
  const navigate = useNavigate()
  const clear = useAuthStore((s) => s.clear)
  const kind = useAuthStore((s) => s.kind)
  const scrolled = useScrolled()

  const logout = () => {
    clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header
        className={cn(
          'sticky top-0 z-30 border-b backdrop-blur transition-[background-color,border-color,box-shadow] duration-300',
          scrolled ? 'border-border-strong bg-bg/90 shadow-sm' : 'border-border bg-bg/80'
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <NavLink to="/app" className="shrink-0" aria-label="ReviewDesk 대시보드">
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
                kind === 'secret'
                  ? '테넌트 secret 키로 로그인(이 테넌트만 접근)'
                  : '글로벌 ADMIN_TOKEN 으로 로그인(셀프호스트 운영자)'
              }
            >
              <span className="hidden sm:inline-flex">
                <Badge tone={kind === 'secret' ? 'info' : 'accent'} size="sm" dot>
                  {kind === 'secret' ? 'secret 키' : 'ADMIN_TOKEN'}
                </Badge>
              </span>
            </Tooltip>
            <ThemeToggle />
            <Tooltip content="자격을 지우고 로그아웃합니다">
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
