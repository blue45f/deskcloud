import { Menu, Moon, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { useSessionStore } from '@/app/sessionStore'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

const NAV = [
  { to: '/catalog', label: '서비스 카탈로그' },
  { to: '/pricing', label: '요금제' },
  { to: '/docs', label: '문서' },
  { to: '/design', label: '디자인' },
] as const

function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      onClick={toggle}
      aria-label={resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {resolved === 'dark' ? <Sun className="size-[1.05rem]" /> : <Moon className="size-[1.05rem]" />}
    </Button>
  )
}

/** 공개(마케팅) 페이지 공통 상단바 — 브랜드 · 내비 · 테마 · 로그인/대시보드 진입. */
export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const isAuthed = useSessionStore((s) => s.isAuthed)

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="DeskCloud 홈" className="shrink-0">
          <Brand />
        </Link>

        <nav aria-label="주요" className="ml-2 hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
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
          {isAuthed ? (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/dashboard">대시보드</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">로그인</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link to="/signup">시작하기</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
          >
            {open ? <X className="size-[1.1rem]" /> : <Menu className="size-[1.1rem]" />}
          </Button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="모바일"
          className="border-t border-border bg-bg px-4 py-3 md:hidden"
        >
          <ul className="space-y-0.5">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent-soft text-accent-fg'
                        : 'text-text-muted hover:bg-surface-2 hover:text-text'
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
            <li className="mt-2 flex gap-2 border-t border-border pt-3">
              {isAuthed ? (
                <Button asChild size="sm" className="flex-1" onClick={() => setOpen(false)}>
                  <Link to="/dashboard">대시보드</Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => setOpen(false)}
                  >
                    <Link to="/login">로그인</Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1" onClick={() => setOpen(false)}>
                    <Link to="/signup">시작하기</Link>
                  </Button>
                </>
              )}
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
