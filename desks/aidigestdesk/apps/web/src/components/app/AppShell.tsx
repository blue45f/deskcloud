import { SNAPSHOT_DATE } from '@aidigestdesk/content'
import {
  BadgePercent,
  BookOpen,
  Boxes,
  Calculator,
  Code2,
  FileText,
  Flame,
  Home,
  MapPin,
  MessagesSquare,
  Moon,
  Newspaper,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Table2,
  UserRound,
} from 'lucide-react'

import type { AdminSession } from '@/components/app/adminSession'
import type { AppRoute } from '@/components/app/appRoutes'
import type { MemberSession } from '@/components/app/memberAuth'
import type { ComponentType } from 'react'

import { IconButton } from '@/components/app/CommonUi'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { SEARCH_INPUT_ID } from '@/hooks/useSearchHotkey'

type NavIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

// 전역 내비게이션(GNB) — 라우트 전환. 디자인 시스템은 사이트맵에서만 노출한다.
const primaryNav: Array<{ id: AppRoute; label: string; icon: NavIcon }> = [
  { id: 'portal', label: '홈', icon: Home },
  { id: 'models', label: '모델·벤치마크', icon: Table2 },
  { id: 'tools', label: '도구·확장', icon: Boxes },
  { id: 'deals', label: '할인·혜택', icon: BadgePercent },
  { id: 'resources', label: '강좌·자료', icon: BookOpen },
  { id: 'community', label: '커뮤니티', icon: MessagesSquare },
]

// 라우트별 섹션 목차 — 사이드바(데스크톱)에서 현재 페이지 내 이동을 돕는다.
const routeSections: Partial<
  Record<AppRoute, Array<{ href: string; label: string; icon: NavIcon }>>
> = {
  portal: [
    { href: '#updates', label: '브리핑', icon: Newspaper },
    { href: '#fresh', label: '신규 등록', icon: Flame },
  ],
  models: [
    { href: '#comparison', label: '모델 카드', icon: Table2 },
    { href: '#local-models', label: '설치형 모델', icon: Boxes },
    { href: '#benchmarks', label: '벤치마크', icon: Table2 },
    { href: '#costs', label: '비용', icon: Calculator },
  ],
  tools: [
    { href: '#task-recommendations', label: '작업 추천', icon: Sparkles },
    { href: '#ai-tools', label: 'AI 도구', icon: Boxes },
    { href: '#extensions', label: '확장 디렉터리', icon: Boxes },
    { href: '#cli-manual', label: 'CLI 실전 매뉴얼', icon: Code2 },
    { href: '#vibe-coding', label: 'CLI 명령어', icon: Code2 },
    { href: '#cli-comparison', label: 'CLI 비교표', icon: Code2 },
    { href: '#design', label: '디자인 워크플로', icon: FileText },
  ],
  deals: [
    { href: '#deals', label: '할인·혜택', icon: BadgePercent },
    { href: '#events', label: '일정/이벤트', icon: Sparkles },
  ],
  resources: [
    { href: '#learning', label: '강좌/자료', icon: BookOpen },
    { href: '#glossary', label: '용어 사전', icon: BookOpen },
    { href: '#manuals', label: '사용법', icon: FileText },
    { href: '#webzine', label: '뉴스 웹진', icon: Newspaper },
    { href: '#translated', label: '해외 소식(번역)', icon: Newspaper },
    { href: '#sources', label: '출처', icon: FileText },
  ],
}

export function Header({
  query,
  onQueryChange,
  route,
  onNavigate,
  adminSession,
  memberSession,
  dark,
  onToggleDark,
}: {
  query: string
  onQueryChange: (value: string) => void
  route: AppRoute
  onNavigate: (route: AppRoute) => void
  adminSession: AdminSession | null
  memberSession: MemberSession | null
  dark: boolean
  onToggleDark: () => void
}) {
  const navButtonClass = (targetRoute: AppRoute) =>
    route === targetRoute
      ? 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-ink bg-ink px-3 text-xs font-semibold text-ink-fg transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-quart)]'
      : 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-transparent px-3 text-xs font-semibold text-text-muted transition-[color,background-color,transform] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-px hover:bg-surface-2 hover:text-text'

  const showSearch = route !== 'admin'

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-5">
        <a
          href={route === 'portal' ? '#main-content' : '/'}
          onClick={(event) => {
            if (route !== 'portal') {
              event.preventDefault()
              onNavigate('portal')
            }
          }}
          className="group flex min-w-0 items-center gap-3"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-ink text-ink-fg transition-shadow duration-200 ease-[var(--ease-out-quart)] group-hover:shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-accent),transparent_80%)]">
            <Sparkles
              className="size-4 transition-transform duration-300 ease-[var(--ease-out-quart)] group-hover:rotate-12 group-hover:scale-110"
              aria-hidden
            />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
              AI Digest Desk
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-3/40 bg-accent-3/10 px-1.5 py-px text-[0.625rem] font-bold tracking-wide text-accent-3 uppercase">
                <span className="live-dot !size-1.5 !bg-accent-3" aria-hidden />
                BETA
              </span>
            </span>
            <span className="block truncate text-xs text-text-subtle">{SNAPSHOT_DATE} 기준</span>
          </span>
        </a>
        <div className="relative ml-auto hidden w-full max-w-md md:block">
          {showSearch ? (
            <>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
              <input
                id={SEARCH_INPUT_ID}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="모델, 기능, 벤치마크, 강좌, 할인 검색"
                className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-10 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
              />
              <kbd
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border bg-bg px-1.5 py-0.5 text-[0.6875rem] font-semibold text-text-subtle lg:block"
              >
                /
              </kbd>
            </>
          ) : (
            <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text-muted">
              <ShieldCheck className="size-4 text-accent" aria-hidden />
              <span className="truncate">
                관리자 콘솔
                {adminSession ? ` · ${adminSession.email}` : ' · 로그인 필요'}
              </span>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <MemberAuthControl />
          <IconButton label={dark ? '라이트 모드' : '다크 모드'} onClick={onToggleDark}>
            {dark ? (
              <Sun className="size-4" aria-hidden />
            ) : (
              <Moon className="size-4" aria-hidden />
            )}
          </IconButton>
          {memberSession ? (
            <button
              type="button"
              onClick={() => onNavigate('account')}
              title="내 계정"
              className={`hidden h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition sm:inline-flex ${
                route === 'account'
                  ? 'border-ink bg-ink text-ink-fg'
                  : 'border-border bg-surface text-text-muted hover:border-border-strong hover:text-text'
              }`}
            >
              <UserRound className="size-3.5" aria-hidden />
              <span className="max-w-24 truncate">{memberSession.displayName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('account')}
              className="hidden h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text sm:inline-flex"
            >
              <UserRound className="size-3.5" aria-hidden />
              로그인
            </button>
          )}
          <span className="sm:hidden">
            <IconButton label="내 계정" onClick={() => onNavigate('account')}>
              <UserRound className="size-4" aria-hidden />
            </IconButton>
          </span>
          <IconButton
            label={route === 'admin' ? '포털로 이동' : '관리자 콘솔'}
            onClick={() => onNavigate(route === 'admin' ? 'portal' : 'admin')}
          >
            {route === 'admin' ? (
              <Home className="size-4" aria-hidden />
            ) : (
              <Settings2 className="size-4" aria-hidden />
            )}
          </IconButton>
        </div>
      </div>

      {/* GNB — 라우트 전환 */}
      <nav
        aria-label="주요 메뉴"
        className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:px-4"
      >
        {primaryNav.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={route === item.id ? 'page' : undefined}
            className={navButtonClass(item.id)}
          >
            <item.icon className="size-3.5" aria-hidden />
            {item.label}
          </button>
        ))}
      </nav>

      {/* 모바일 검색 */}
      {showSearch ? (
        <div className="border-t border-border px-4 py-3 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="검색"
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none focus:border-accent"
            />
          </div>
        </div>
      ) : null}
    </header>
  )
}

export function Sidebar({
  route,
  onNavigate,
}: {
  route: AppRoute
  onNavigate: (route: AppRoute) => void
}) {
  const sections = routeSections[route] ?? []

  return (
    <aside className="hidden border-r border-border bg-surface/70 lg:block">
      <div className="sticky top-[7.25rem] flex h-[calc(100vh-7.25rem)] w-60 flex-col px-3 py-4">
        {sections.length ? (
          <>
            <p className="px-3 pb-2 text-xs font-semibold text-text-subtle">이 페이지 목차</p>
            <nav className="space-y-1">
              {sections.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-2 hover:text-text"
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </a>
              ))}
            </nav>
          </>
        ) : null}
        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('sitemap')}
            className="flex w-full items-center gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-text-muted transition hover:border-border-strong hover:text-text"
          >
            <MapPin className="size-4" aria-hidden />
            전체 사이트맵
          </button>
          <div className="rounded-md border border-border bg-bg p-3">
            <p className="text-xs font-semibold text-text">소스 워치</p>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              공식 문서, 벤치마크, 출판사, 한국어 커뮤니티 링크를 분리 보관합니다.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
