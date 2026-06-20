import { ROLE_LABELS, type SessionDto } from '@termsdesk/shared'
import { LogOut, Menu, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'

import { useTheme } from '@/app/ThemeContext'
import { NotifyInbox } from '@/components/deskcloud/notify/NotifyInbox'
import { Button } from '@/components/ui/button'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown'
import { useLogout } from '@/services/auth'

export function Topbar({ session, onMenu }: { session: SessionDto; onMenu: () => void }) {
  const { resolved, toggle } = useTheme()
  const navigate = useNavigate()
  const logout = useLogout()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onMenu}
          aria-label="메뉴 열기"
        >
          <Menu className="size-5" />
        </Button>
        <div className="lg:hidden">
          <Brand />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* 약관 의뢰 중계 인앱 알림 — 제안·매칭·납품·평가 이벤트. */}
        <NotificationBell />
        {/* NotifyDesk 네이티브 알림 인박스 — VITE_NOTIFYDESK_URL 설정 시에만 렌더(미설정=영향 없음). */}
        <NotifyInbox recipientId={session.user.id} />
        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="테마 전환">
          {resolved === 'dark' ? (
            <Sun className="size-[1.05rem]" />
          ) : (
            <Moon className="size-[1.05rem]" />
          )}
        </Button>
        <Dropdown>
          <DropdownTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-1.5 py-1 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-strong">
              <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-fg">
                {session.user.name.slice(0, 1)}
              </span>
              <span className="hidden text-sm text-text sm:inline">{session.user.name}</span>
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>{session.user.email}</DropdownLabel>
            <div className="px-2.5 pb-1.5 text-xs text-text-subtle">
              {ROLE_LABELS[session.user.role]}
            </div>
            <DropdownSeparator />
            <DropdownItem
              danger
              onSelect={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
            >
              <LogOut className="size-4" />
              로그아웃
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  )
}
