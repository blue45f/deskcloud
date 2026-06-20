import { LogOut, Moon, Sun } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAdminStore } from '@/app/adminStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
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
  { to: '/app', label: '대시보드', end: true },
  { to: '/app/editor', label: '설문 에디터' },
  { to: '/app/guide', label: '임베드 가이드' },
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
  const clear = useAdminStore((s) => s.clear)
  const scrolled = useScrolled(8)

  const logout = () => {
    clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header
        className={cn(
          'sticky top-0 z-30 border-b backdrop-blur transition-[background-color,border-color,box-shadow] duration-300',
          scrolled
            ? 'border-border-strong bg-bg/90 shadow-sm supports-[backdrop-filter]:bg-bg/75'
            : 'border-border bg-bg/70 supports-[backdrop-filter]:bg-bg/60'
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <NavLink to="/app" className="group/navlink shrink-0" aria-label="SurveyDesk 대시보드">
            <Brand lamp />
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
            <ThemeToggle />
            <Tooltip content="어드민 토큰을 지우고 로그아웃합니다">
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
