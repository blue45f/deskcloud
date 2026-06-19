import { LogOut, Moon, Sun } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router-dom'

import { useSessionStore } from '@/app/sessionStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

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

/** 콘솔 셸 — 상단바(브랜드·테마·로그아웃) + 본문 컨테이너(Outlet). */
export default function AppLayout() {
  const navigate = useNavigate()
  const clear = useSessionStore((s) => s.clear)

  const logout = () => {
    clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/dashboard" className="shrink-0" aria-label="DeskCloud 콘솔">
            <Brand />
          </Link>
          <span className="hidden text-sm text-text-subtle sm:inline">/ 콘솔</span>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/inquiries">문의</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/catalog">카탈로그</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/docs">문서</Link>
            </Button>
            <ThemeToggle />
            <Tooltip content="저장된 키를 지우고 로그아웃합니다">
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
