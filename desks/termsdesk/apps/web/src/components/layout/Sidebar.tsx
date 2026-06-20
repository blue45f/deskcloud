import { can, type SessionDto } from '@termsdesk/shared'
import {
  Briefcase,
  Code2,
  FileCheck2,
  Gavel,
  Handshake,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  PlayCircle,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { Brand } from './Brand'

import { OrgIcon } from '@/components/common/OrgIcon'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  adminOnly?: boolean
}

interface NavGroup {
  heading?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ to: '/app', label: '개요', icon: LayoutDashboard, end: true }],
  },
  {
    heading: '약관 의뢰 중계',
    items: [
      { to: '/app/requests', label: '내 의뢰', icon: Handshake },
      { to: '/app/marketplace', label: '의뢰 마켓', icon: Store },
      { to: '/app/expert', label: '전문가 활동', icon: Briefcase },
      { to: '/app/moderation', label: '중계 모더레이션', icon: Gavel, adminOnly: true },
    ],
  },
  {
    heading: '증거 인프라',
    items: [
      { to: '/app/policies', label: '약관·정책', icon: ScrollText },
      { to: '/app/consents', label: '동의 영수증', icon: FileCheck2 },
      { to: '/app/inquiries', label: '문의 보드', icon: Inbox },
      { to: '/app/audit', label: '감사 로그', icon: History },
    ],
  },
  {
    heading: '개발·운영',
    items: [
      { to: '/app/api-keys', label: 'API 키', icon: KeyRound },
      { to: '/app/demo', label: '라이브 데모', icon: PlayCircle },
      { to: '/app/guide', label: '연동 가이드', icon: Code2 },
      { to: '/app/admin', label: '관리자', icon: ShieldCheck, adminOnly: true },
      { to: '/app/settings', label: '설정', icon: Settings },
    ],
  },
]

export function Sidebar({ session, onNavigate }: { session: SessionDto; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <Brand />
        <div className="mt-3 flex items-center gap-2">
          <OrgIcon
            name={session.org.name}
            logoUrl={session.org.logoUrl}
            className="size-5 rounded-md text-[0.65rem]"
          />
          <span className="truncate text-[0.8125rem] font-medium text-text-muted">
            {session.org.name}
          </span>
          <Badge tone={session.mode === 'saas' ? 'info' : 'accent'} size="sm">
            {session.mode === 'saas' ? 'SaaS' : 'self-hosted'}
          </Badge>
        </div>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-2.5 py-2" aria-label="주 메뉴">
        {NAV_GROUPS.map((group, gi) => {
          const items = group.items.filter(
            (item) => !item.adminOnly || can(session.user.role, 'member.manage')
          )
          if (items.length === 0) return null
          return (
            <div key={group.heading ?? gi} className="space-y-0.5">
              {group.heading ? (
                <p className="px-2.5 pb-1 pt-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-subtle">
                  {group.heading}
                </p>
              ) : null}
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-strong',
                      isActive
                        ? 'bg-surface-2 text-text'
                        : 'text-text-muted hover:bg-surface-2 hover:text-text'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'size-[1.05rem] shrink-0 transition-colors',
                          isActive
                            ? 'text-accent-strong'
                            : 'text-text-subtle group-hover:text-text-muted'
                        )}
                      />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <p className="text-[0.6875rem] leading-relaxed text-text-subtle">
          약관을 직접 작성하지 않습니다. 전문가를 연결하고, 버전·게시·증거를 관리합니다.
        </p>
      </div>
    </div>
  )
}
