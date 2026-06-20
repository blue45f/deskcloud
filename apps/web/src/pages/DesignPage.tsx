import {
  ArrowUpRight,
  Check,
  Inbox,
  Lock,
  MessagesSquare,
  Moon,
  Pin,
  Search,
  Sun,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { ReactionChips } from '@/components/feature/ReactionChips'
import { StatCard } from '@/components/feature/StatCard'
import { Badge, BoardKindBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Label, Select, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/utils/cn'

/* ──────────────────────────────────────────────────────────────────────────
   라이브 스타일 가이드 — 이 프로젝트의 실제 토큰(styles/index.css)과
   components/ui 를 그대로 보여 준다. 새 팔레트·새 컴포넌트를 만들지 않는다.
   ────────────────────────────────────────────────────────────────────────── */

const NAV = [
  { id: 'color', label: '색상' },
  { id: 'typography', label: '타이포그래피' },
  { id: 'space', label: '간격·반경·그림자' },
  { id: 'motion', label: '모션' },
  { id: 'components', label: '컴포넌트' },
] as const

/** getComputedStyle 으로 토큰을 즉시 해석한다. themeKey(현재 테마) 가 바뀌면 다시 읽는다. */
function useResolvedToken(cssVar: string, themeKey: string): string {
  const [value, setValue] = useState('')
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
    // getComputedStyle 은 페인트 이후에만 정확하므로 외부 시스템(CSS)→React 동기화로
    // 효과 안에서 setState 하는 것이 올바르다(읽기 전용 외부 스토어 구독 패턴).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 계산된 스타일은 effect 에서만 정확
    setValue(raw)
  }, [cssVar, themeKey])
  return value
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string
  eyebrow?: string
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-14 first:border-t-0">
      <div className="mb-8 max-w-[68ch]">
        {eyebrow ? (
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-accent-strong uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-text">{title}</h2>
        {intro ? <p className="mt-2 text-sm text-pretty text-text-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Demo({
  caption,
  children,
  className,
}: {
  caption: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-4',
          className
        )}
      >
        {children}
      </div>
      <p className="px-0.5 text-xs text-text-subtle">{caption}</p>
    </div>
  )
}

function ColorSwatch({
  cssVar,
  name,
  themeKey,
  className,
}: {
  cssVar: string
  name: string
  themeKey: string
  className?: string
}) {
  const resolved = useResolvedToken(cssVar, themeKey)
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn('size-10 shrink-0 rounded-md border border-border-strong/60', className)}
        style={{ background: `var(${cssVar})` }}
        aria-hidden
      />
      <div className="min-w-0 leading-tight">
        <p className="truncate font-mono text-[0.8125rem] text-text">{name}</p>
        <p className="truncate font-mono text-[0.6875rem] text-text-subtle">{resolved || '—'}</p>
      </div>
    </div>
  )
}

const SURFACE_TOKENS = [
  { v: '--color-bg', n: 'bg' },
  { v: '--color-surface', n: 'surface' },
  { v: '--color-surface-2', n: 'surface-2' },
  { v: '--color-border', n: 'border' },
  { v: '--color-border-strong', n: 'border-strong' },
]
const TEXT_TOKENS = [
  { v: '--color-text', n: 'text' },
  { v: '--color-text-muted', n: 'text-muted' },
  { v: '--color-text-subtle', n: 'text-subtle' },
  { v: '--color-ink', n: 'ink' },
]
const ACCENT_TOKENS = [
  { v: '--color-accent', n: 'accent' },
  { v: '--color-accent-strong', n: 'accent-strong' },
  { v: '--color-accent-soft', n: 'accent-soft' },
  { v: '--color-accent-fg', n: 'accent-fg' },
]
const SEMANTIC = [
  { base: '--color-success', soft: '--color-success-soft', n: 'success' },
  { base: '--color-info', soft: '--color-info-soft', n: 'info' },
  { base: '--color-warning', soft: '--color-warning-soft', n: 'warning' },
  { base: '--color-danger', soft: '--color-danger-soft', n: 'danger' },
]

const TYPE_SCALE = [
  { cls: 'text-[2rem] font-semibold tracking-tight', label: 'Display · 2rem / 650' },
  { cls: 'text-2xl font-semibold tracking-tight', label: 'Heading · 1.5rem / 650' },
  { cls: 'text-xl font-semibold', label: 'Title · 1.25rem' },
  { cls: 'text-base font-semibold', label: 'Subtitle · 1rem' },
  { cls: 'text-sm', label: 'Body · 0.875rem (기본)' },
  { cls: 'text-[0.8125rem] text-text-muted', label: 'Body small · 0.8125rem / muted' },
  { cls: 'text-xs text-text-subtle', label: 'Caption · 0.75rem / subtle' },
]

const SPACE_STEPS = [
  { label: 'gap-1 · 0.25rem', w: '0.25rem' },
  { label: 'gap-2 · 0.5rem', w: '0.5rem' },
  { label: 'gap-3 · 0.75rem', w: '0.75rem' },
  { label: 'gap-4 · 1rem', w: '1rem' },
  { label: 'gap-6 · 1.5rem', w: '1.5rem' },
  { label: 'gap-8 · 2rem', w: '2rem' },
]
const RADII = [
  { cls: 'rounded-sm', label: 'sm · 0.375rem' },
  { cls: 'rounded-md', label: 'md · 0.5rem' },
  { cls: 'rounded-lg', label: 'lg · 0.75rem' },
  { cls: 'rounded-xl', label: 'xl · 1rem' },
]
const SHADOWS = [
  { cls: 'shadow-xs', label: 'shadow-xs' },
  { cls: 'shadow-sm', label: 'shadow-sm' },
  { cls: 'shadow-md', label: 'shadow-md' },
  { cls: 'shadow-lg', label: 'shadow-lg' },
]

const BTN_VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'accent', 'danger'] as const

export default function DesignPage() {
  useDocumentTitle('디자인 시스템')
  const { resolved, toggle } = useTheme()

  const [active, setActive] = useState<string>(NAV[0].id)
  const switchId = useId()
  const motionRef = useRef<HTMLDivElement>(null)

  // 스크롤 스파이 — 현재 보이는 섹션을 인-페이지 내비에 반영.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] }
    )
    NAV.forEach((n) => {
      const el = document.getElementById(n.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  const replayMotion = useCallback(() => {
    const el = motionRef.current
    if (!el) return
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.animation = ''
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <MessagesSquare className="size-5 shrink-0 text-accent-strong" aria-hidden />
            <span className="truncate text-sm font-bold tracking-tight text-text">
              CommunityDesk
            </span>
            <span className="hidden text-sm text-text-subtle sm:inline">/ Design System</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">홈으로</Link>
            </Button>
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
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl gap-10 px-4 sm:px-6 lg:grid lg:grid-cols-[180px_1fr]">
        <nav aria-label="섹션" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5 py-14 text-sm">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  aria-current={active === n.id ? 'true' : undefined}
                  className={cn(
                    'block rounded-md px-3 py-1.5 transition-colors',
                    active === n.id
                      ? 'bg-accent-soft font-medium text-accent-fg'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text'
                  )}
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main-content" tabIndex={-1} className="min-w-0 pb-20 outline-none">
          {/* 히어로 */}
          <div className="border-b border-border py-14">
            <Badge tone="accent" size="sm">
              살아있는 스타일 가이드
            </Badge>
            <h1 className="mt-3 max-w-[18ch] text-[clamp(2rem,5vw,3rem)] font-semibold tracking-tight text-balance text-text">
              임베드 커뮤니티를 받치는 디자인 토큰과 컴포넌트
            </h1>
            <p className="mt-4 max-w-[65ch] text-pretty text-text-muted">
              이 페이지는 CommunityDesk 의 실제 디자인 시스템을 그대로 렌더링합니다. 색상은{' '}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                styles/index.css
              </code>{' '}
              의 OKLCH 토큰에서, 컴포넌트는{' '}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                components/ui
              </code>{' '}
              에서 직접 가져옵니다. 우상단 토글로 라이트·다크 값을 즉시 확인하세요.
            </p>
          </div>

          {/* 색상 */}
          <Section
            id="color"
            eyebrow="Foundations"
            title="색상"
            intro="각 스와치 옆 값은 현재 테마에서 getComputedStyle 로 해석한 실제 OKLCH 값입니다. 테마를 토글하면 그 자리에서 다시 계산됩니다."
          >
            <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-[0.8125rem] font-semibold text-text">강조 (accent)</h3>
                <div className="space-y-2.5">
                  {ACCENT_TOKENS.map((t) => (
                    <ColorSwatch key={t.v} cssVar={t.v} name={t.n} themeKey={resolved} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-[0.8125rem] font-semibold text-text">표면 · 경계</h3>
                <div className="space-y-2.5">
                  {SURFACE_TOKENS.map((t) => (
                    <ColorSwatch key={t.v} cssVar={t.v} name={t.n} themeKey={resolved} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-[0.8125rem] font-semibold text-text">텍스트 · 잉크</h3>
                <div className="space-y-2.5">
                  {TEXT_TOKENS.map((t) => (
                    <ColorSwatch key={t.v} cssVar={t.v} name={t.n} themeKey={resolved} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-[0.8125rem] font-semibold text-text">
                  의미색 (base + soft)
                </h3>
                <div className="space-y-2.5">
                  {SEMANTIC.map((s) => (
                    <div key={s.n} className="flex items-center gap-2">
                      <ColorSwatch
                        cssVar={s.base}
                        name={s.n}
                        themeKey={resolved}
                        className="size-9"
                      />
                      <span
                        className="size-9 shrink-0 rounded-md border border-border-strong/40"
                        style={{ background: `var(${s.soft})` }}
                        title={`${s.n}-soft`}
                        aria-hidden
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* 타이포그래피 */}
          <Section
            id="typography"
            eyebrow="Foundations"
            title="타이포그래피"
            intro={
              <>
                본문은 Pretendard Variable 한 가족으로 헤딩·라벨·데이터까지 운용합니다.
                수치·코드·키는{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  --font-mono
                </code>
                .
              </>
            }
          >
            <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,32ch)]">
              <div className="space-y-4">
                {TYPE_SCALE.map((t) => (
                  <div
                    key={t.label}
                    className="flex flex-col gap-1 border-b border-border pb-4 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                  >
                    <span className={cn('text-text', t.cls)}>새 글이 올라오는 중입니다</span>
                    <span className="shrink-0 font-mono text-xs text-text-subtle">{t.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-1">
                  <span className="font-mono text-sm text-text">mono · pk_live_8f2a · ❤ 248</span>
                  <span className="font-mono text-xs text-text-subtle">--font-mono</span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="mb-2 text-xs font-semibold text-text-subtle">본문 가독폭 · 약 68ch</p>
                <p className="max-w-[68ch] text-pretty text-text-muted">
                  CommunityDesk 는 외부 서비스에 게시판·카페를 한 줄로 붙입니다. 엔드유저가 글·중첩
                  댓글·이모지 반응을 남기면 운영자는 검수 큐에서 고정·잠금·숨김·삭제로 운영합니다.
                  본문은 65–75ch 범위로 줄길이를 제한해 장문도 편안하게 읽히도록 합니다.
                </p>
              </div>
            </div>
          </Section>

          {/* 간격·반경·그림자 */}
          <Section
            id="space"
            eyebrow="Foundations"
            title="간격 · 반경 · 그림자"
            intro="스케일은 Tailwind 기본 단계를, 반경·그림자는 @theme 토큰을 그대로 사용합니다."
          >
            <div className="grid gap-10 lg:grid-cols-3">
              <div>
                <h3 className="mb-4 text-[0.8125rem] font-semibold text-text">간격</h3>
                <div className="space-y-2.5">
                  {SPACE_STEPS.map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span
                        className="h-3 rounded-sm bg-accent"
                        style={{ width: s.w }}
                        aria-hidden
                      />
                      <span className="font-mono text-xs text-text-subtle">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-4 text-[0.8125rem] font-semibold text-text">모서리 반경</h3>
                <div className="grid grid-cols-2 gap-3">
                  {RADII.map((r) => (
                    <div key={r.label} className="flex flex-col items-center gap-2">
                      <span
                        className={cn(
                          'grid h-14 w-full place-items-center border border-border-strong/50 bg-surface-2',
                          r.cls
                        )}
                        aria-hidden
                      />
                      <span className="font-mono text-[0.6875rem] text-text-subtle">{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-4 text-[0.8125rem] font-semibold text-text">엘리베이션</h3>
                <div className="grid grid-cols-2 gap-4">
                  {SHADOWS.map((s) => (
                    <div key={s.label} className="flex flex-col items-center gap-2">
                      <span
                        className={cn('h-14 w-full rounded-lg bg-surface', s.cls)}
                        aria-hidden
                      />
                      <span className="font-mono text-[0.6875rem] text-text-subtle">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* 모션 */}
          <Section
            id="motion"
            eyebrow="Foundations"
            title="모션"
            intro="전환은 대부분 120–220ms, ease-out 계열(cubic-bezier(0.22, 1, 0.36, 1))을 씁니다. 모든 애니메이션은 prefers-reduced-motion 에서 전역 규칙으로 무력화됩니다."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[0.8125rem] font-semibold text-text">slide-up · 220ms</h3>
                  <Button variant="outline" size="sm" onClick={replayMotion}>
                    다시 재생
                  </Button>
                </div>
                <div className="mt-4 grid h-24 place-items-center overflow-hidden rounded-md bg-surface-2">
                  <div
                    ref={motionRef}
                    className="rounded-md border border-border bg-bg px-4 py-2 text-sm text-text shadow-sm [animation:slide-up_220ms_cubic-bezier(0.22,1,0.36,1)]"
                  >
                    글이 등록되었습니다 ✓
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-xs">
                  <dt className="text-text-subtle">fade-in</dt>
                  <dd className="text-right font-mono text-text-muted">120–150ms ease-out</dd>
                  <dt className="text-text-subtle">pop-in (Dialog)</dt>
                  <dd className="text-right font-mono text-text-muted">160ms</dd>
                  <dt className="text-text-subtle">slide-up (Sheet)</dt>
                  <dd className="text-right font-mono text-text-muted">220ms</dd>
                </dl>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="text-[0.8125rem] font-semibold text-text">상태 전환 (150ms)</h3>
                <p className="mt-1 text-xs text-text-subtle">
                  hover 해 보세요 — 버튼·링크 색은 모두 같은 곡선으로 움직입니다.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button>기본</Button>
                  <Button variant="secondary">보조</Button>
                  <Button variant="accent">강조</Button>
                </div>
                <a
                  href="#components"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-strong transition-colors hover:text-accent"
                >
                  컴포넌트 갤러리로 <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </div>
            </div>
          </Section>

          {/* 컴포넌트 갤러리 */}
          <Section
            id="components"
            eyebrow="Library"
            title="컴포넌트"
            intro="실제 components 모듈을 그대로 렌더링합니다 — 변형 · 크기 · 상태별 캡션 포함."
          >
            {/* Buttons */}
            <h3 className="mb-3 text-base font-semibold text-text">버튼</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Demo caption="6개 변형 — primary · secondary · outline · ghost · accent · danger">
                {BTN_VARIANTS.map((v) => (
                  <Button key={v} variant={v} size="sm">
                    {v}
                  </Button>
                ))}
              </Demo>
              <Demo caption="크기 — sm · md · lg · icon">
                <Button size="sm">sm</Button>
                <Button size="md">md</Button>
                <Button size="lg">lg</Button>
                <Button size="icon" aria-label="검색">
                  <Search className="size-4" />
                </Button>
              </Demo>
              <Demo caption="상태 — loading · disabled">
                <Button loading>저장 중</Button>
                <Button disabled>비활성</Button>
                <Button variant="secondary" disabled>
                  비활성
                </Button>
              </Demo>
              <Demo caption="아이콘 동반 · asChild(링크)">
                <Button variant="accent" size="sm">
                  <Pin className="size-4" />
                  고정
                </Button>
                <Button variant="danger" size="sm">
                  <Trash2 className="size-4" />
                  삭제
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/">
                    홈 <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </Demo>
            </div>

            {/* Badges */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">배지 · 상태 칩</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Demo caption="Badge tone — neutral · accent · success · info · warning · danger · outline">
                <Badge tone="neutral">neutral</Badge>
                <Badge tone="accent">accent</Badge>
                <Badge tone="success">success</Badge>
                <Badge tone="info">info</Badge>
                <Badge tone="warning">warning</Badge>
                <Badge tone="danger">danger</Badge>
                <Badge tone="outline">outline</Badge>
              </Demo>
              <Demo caption="도메인 칩 — 게시판 종류 · 콘텐츠 상태 · 반응 집계">
                <BoardKindBadge kind="board" />
                <BoardKindBadge kind="cafe" />
                <StatusBadge status="visible" />
                <StatusBadge status="pending" />
                <StatusBadge status="hidden" />
                <ReactionChips reactions={{ like: 18, love: 7, laugh: 3 }} />
              </Demo>
            </div>

            {/* Stat cards */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">집계 — 지표 카드</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="총 글" value="1,248" hint="이번 달 +96" icon={MessagesSquare} />
              <StatCard
                label="검수 대기"
                value="7"
                hint="숨김·승인 필요"
                tone="warning"
                icon={Pin}
              />
              <StatCard
                label="이번 달 읽기"
                value="42.1k"
                hint="무료 플랜 50k 한도"
                tone="success"
              />
            </div>

            {/* Forms */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">폼 컨트롤</h3>
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardContent className="space-y-4">
                  <Field label="게시판 이름" htmlFor="d-name" hint="목록과 위젯 헤더에 노출됩니다.">
                    <Input id="d-name" placeholder="예: 자유게시판" />
                  </Field>
                  <Field
                    label="slug"
                    htmlFor="d-error"
                    required
                    error="slug 는 소문자·숫자·하이픈만 가능합니다."
                  >
                    <Input id="d-error" defaultValue="자유 게시판!" aria-invalid />
                  </Field>
                  <Field label="종류" htmlFor="d-type">
                    <Select id="d-type" defaultValue="board">
                      <option value="board">게시판 (board)</option>
                      <option value="cafe">카페 (cafe)</option>
                    </Select>
                  </Field>
                </CardContent>
                <CardFooter className="text-xs text-text-subtle">
                  default · focus · error · disabled 상태를 모두 갖춘 Field 프리미티브
                </CardFooter>
              </Card>
              <Card>
                <CardContent className="space-y-4">
                  <Field label="설명" htmlFor="d-textarea" hint="게시판의 용도를 짧게.">
                    <Textarea id="d-textarea" placeholder="이 게시판은 어떤 글을 위한 곳인가요?" />
                  </Field>
                  <Field label="slug (불변)" htmlFor="d-disabled" hint="생성 후 변경 불가">
                    <Input id="d-disabled" defaultValue="notice" disabled className="font-mono" />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Checkbox id="d-check" defaultChecked />
                    <Label htmlFor="d-check" className="mb-0">
                      새 글 검수 대기로 받기
                    </Label>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
                    <Label htmlFor={switchId} className="mb-0">
                      댓글 허용 (Switch)
                    </Label>
                    <Switch id={switchId} defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">탭</h3>
            <Card>
              <CardContent>
                <Tabs defaultValue="posts">
                  <TabsList>
                    <TabsTrigger value="posts">글</TabsTrigger>
                    <TabsTrigger value="comments">댓글</TabsTrigger>
                    <TabsTrigger value="embed">임베드</TabsTrigger>
                  </TabsList>
                  <TabsContent value="posts" className="pt-4 text-sm text-text-muted">
                    활성 탭은 하단 보더가 accent 색으로 강조됩니다.
                  </TabsContent>
                  <TabsContent value="comments" className="pt-4 text-sm text-text-muted">
                    댓글 검수 큐가 여기에 들어갑니다.
                  </TabsContent>
                  <TabsContent value="embed" className="pt-4 text-sm text-text-muted">
                    React·스크립트 스니펫이 여기에 들어갑니다.
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Overlays */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">
              오버레이 — Dialog · Tooltip
            </h3>
            <Demo caption="모두 포털로 렌더링되어 overflow 를 벗어납니다.">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Dialog 열기
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>이 글을 숨길까요?</DialogTitle>
                    <DialogDescription>
                      숨김 처리하면 위젯에서 즉시 사라지고, 검수 큐에서 다시 노출할 수 있습니다.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost" size="sm">
                        취소
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="danger" size="sm">
                        숨기기
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Tooltip content="이 글을 상단에 고정합니다">
                <Button variant="ghost" size="sm">
                  Tooltip (hover)
                </Button>
              </Tooltip>

              <span className="inline-flex items-center gap-1 text-text-subtle">
                <Pin className="size-4" aria-hidden />
                <Lock className="size-4" aria-hidden />
              </span>
            </Demo>

            {/* CodeBlock */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">코드 블록 (복사)</h3>
            <CodeBlock
              code={`<div id="community"></div>
<script src="https://community.example.com/community-widget.js" defer></script>
<script>
  CommunityDesk.mount('#community', { publishableKey: 'pk_live_xxx', boardSlug: 'free' })
</script>`}
              language="html"
              className="max-w-2xl"
            />

            {/* Cards */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">카드</h3>
            <Card className="max-w-md">
              <CardHeader action={<BoardKindBadge kind="cafe" />}>
                <CardTitle>오늘 다녀온 카페 후기 모음</CardTitle>
                <CardDescription>카페 · 글 1,248건 · 최근 갱신 2026.06.15</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-text-muted">
                Header · Content · Footer 슬롯과 헤더 action 영역을 가진 합성 카드입니다. 카드를
                중첩하지 않습니다.
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="font-mono text-xs text-text-subtle">slug: cafe-reviews</span>
                <Button variant="ghost" size="sm">
                  검수 큐로 <ArrowUpRight className="size-3.5" />
                </Button>
              </CardFooter>
            </Card>

            {/* Feedback */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">
              피드백 — 로딩 · 빈 상태
            </h3>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Card>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </CardContent>
                </Card>
                <p className="px-0.5 text-xs text-text-subtle">
                  스피너 대신 콘텐츠 모양의 스켈레톤으로 로딩을 알립니다.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <EmptyState
                  icon={Inbox}
                  title="검수할 글이 없습니다"
                  description="위젯이 받은 새 글·댓글이 여기 검수 큐로 흘러들어오면 표시됩니다."
                  action={
                    <Button size="sm" variant="accent">
                      <Check className="size-4" /> 모두 확인
                    </Button>
                  }
                />
                <p className="px-0.5 text-xs text-text-subtle">
                  빈 상태는 다음 행동을 안내합니다 — &ldquo;아무것도 없음&rdquo;이 아니라.
                </p>
              </div>
            </div>
          </Section>

          <p className="border-t border-border pt-8 text-xs text-text-subtle">
            이 페이지는 CommunityDesk 의 실제 토큰과 컴포넌트만 사용합니다. 새 색·새 컴포넌트를
            만들지 않습니다.
          </p>
        </main>
      </div>
    </div>
  )
}
