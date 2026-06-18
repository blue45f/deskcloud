import {
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  FileText,
  Inbox,
  Moon,
  RotateCw,
  Search,
  Sun,
} from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { DeskGlyph } from '@/components/feature/DeskGlyph'
import { Badge, PlanBadge, StatusBadge } from '@/components/ui/badge'
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
import { Banner, CopyButton, EmptyState, Skeleton } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Label, Select, Textarea } from '@/components/ui/field'
import { Meter } from '@/components/ui/meter'
import { StatCard } from '@/components/ui/stat-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/utils/cn'

/* ──────────────────────────────────────────────────────────────────────────
   라이브 스타일 가이드 — DeskCloud 의 실제 토큰(styles/index.css)과
   components/ui 를 그대로 렌더링한다. 새 팔레트를 만들지 않는다.
   ────────────────────────────────────────────────────────────────────────── */

const NAV = [
  { id: 'color', label: '색상' },
  { id: 'typography', label: '타이포그래피' },
  { id: 'space', label: '간격·반경·그림자' },
  { id: 'motion', label: '모션' },
  { id: 'components', label: '컴포넌트' },
] as const

/**
 * getComputedStyle 으로 토큰을 해석한다. 테마 토글마다 다시 읽도록 themeKey 의존.
 * 계산된 스타일은 레이아웃 이후에 안정적이므로 rAF 로 한 프레임 뒤 읽는다(이펙트
 * 본문에서 동기 setState 를 피해 cascading render 도 방지).
 */
function useResolvedToken(cssVar: string, themeKey: string): string {
  const [value, setValue] = useState('')
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setValue(getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim())
    })
    return () => cancelAnimationFrame(id)
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
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-ink-fg">
              <Boxes className="size-4" aria-hidden />
            </span>
            <span className="truncate text-sm font-bold tracking-tight text-text">DeskCloud</span>
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
            <h1 className="mt-3 max-w-[20ch] text-[clamp(2rem,5vw,3rem)] font-semibold tracking-tight text-balance text-text">
              DeskCloud 플랫폼을 받치는 디자인 토큰과 컴포넌트
            </h1>
            <p className="mt-4 max-w-[65ch] text-pretty text-text-muted">
              이 페이지는 DeskCloud 의 실제 디자인 시스템을 그대로 렌더링합니다. 색상은{' '}
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
                본문은 Pretendard Variable 한 가족으로 헤딩·라벨·데이터까지 운용합니다. 수치·코드는{' '}
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
                    <span className={cn('text-text', t.cls)}>한 줄로 붙이는 SaaS 인프라</span>
                    <span className="shrink-0 font-mono text-xs text-text-subtle">{t.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-1">
                  <span className="font-mono text-sm text-text">mono · pk_live_… · ₩29,000/월</span>
                  <span className="font-mono text-xs text-text-subtle">--font-mono</span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="mb-2 text-xs font-semibold text-text-subtle">본문 가독폭 · 약 68ch</p>
                <p className="max-w-[68ch] text-pretty text-text-muted">
                  DeskCloud 는 여러 SaaS 를 하나의 계정·빌링으로 묶습니다. 각 Desk 는 독립
                  서비스지만 동일한 멀티테넌트 코어를 공유합니다. 본문은 65–75ch 범위로 줄길이를
                  제한해 장문도 편안하게 읽히도록 합니다.
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
                    <RotateCw className="size-3.5" /> 다시 재생
                  </Button>
                </div>
                <div className="mt-4 grid h-24 place-items-center overflow-hidden rounded-md bg-surface-2">
                  <div
                    ref={motionRef}
                    className="rounded-md border border-border bg-bg px-4 py-2 text-sm text-text shadow-sm [animation:slide-up_220ms_cubic-bezier(0.22,1,0.36,1)]"
                  >
                    테넌트 생성됨 ✓
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-xs">
                  <dt className="text-text-subtle">fade-in</dt>
                  <dd className="text-right font-mono text-text-muted">120–150ms ease-out</dd>
                  <dt className="text-text-subtle">pop-in (Dialog)</dt>
                  <dd className="text-right font-mono text-text-muted">160ms</dd>
                  <dt className="text-text-subtle">meter-grow</dt>
                  <dd className="text-right font-mono text-text-muted">500ms</dd>
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
            intro="실제 components/ui 모듈을 그대로 렌더링합니다 — 변형 · 크기 · 상태별 캡션 포함."
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
                  <Check className="size-4" />
                  업그레이드
                </Button>
                <Button variant="secondary" size="sm">
                  <RotateCw className="size-4" />키 회전
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/catalog">
                    카탈로그 <ArrowUpRight className="size-3.5" />
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
              <Demo caption="도메인 칩 — PlanBadge(4종) · StatusBadge">
                <PlanBadge plan="free" />
                <PlanBadge plan="pro" />
                <PlanBadge plan="scale" />
                <PlanBadge plan="enterprise" />
                <StatusBadge status="active" />
                <StatusBadge status="incomplete" />
                <StatusBadge status="canceled" />
              </Demo>
            </div>

            {/* Glyphs */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">Desk 글리프</h3>
            <Demo caption="DeskGlyph — tone(accent·info·success·warning) × size(sm·md·lg)">
              <DeskGlyph icon={FileText} tone="info" />
              <DeskGlyph icon={Bell} tone="accent" />
              <DeskGlyph icon={Search} tone="success" />
              <DeskGlyph icon={Inbox} tone="warning" />
              <DeskGlyph icon={Boxes} tone="accent" size="lg" />
            </Demo>

            {/* Stat cards + Meter */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">
              지표 카드 · 사용량 미터
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="활성 테넌트" value="1,284" hint="전월 대비 +8%" />
              <StatCard label="MRR" value="₩4.2M" hint="Pro 96 · Scale 21" tone="success" />
              <StatCard label="이번 달 API" value="182K" hint="Pro 한도 200K" tone="warning" />
            </div>
            <Card className="mt-4 max-w-md">
              <CardHeader action={<PlanBadge plan="pro" size="sm" />}>
                <CardTitle>사용량 — Pro 플랜</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Meter label="API 호출" used={182_000} limit={200_000} />
                <Meter label="이벤트" used={12_400} limit={50_000} />
                <Meter label="저장(MiB)" used={5_120} limit={5_000} />
              </CardContent>
            </Card>

            {/* Forms */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">폼 컨트롤</h3>
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardContent className="space-y-4">
                  <Field label="조직 이름" htmlFor="d-name" hint="콘솔·청구서에 노출됩니다.">
                    <Input id="d-name" placeholder="예: Acme Inc." />
                  </Field>
                  <Field
                    label="slug"
                    htmlFor="d-error"
                    error="slug 는 소문자·숫자·하이픈만 가능합니다."
                  >
                    <Input id="d-error" defaultValue="Acme!" aria-invalid />
                  </Field>
                  <Field label="기본 플랜" htmlFor="d-type">
                    <Select id="d-type" defaultValue="free">
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="scale">Scale</option>
                      <option value="enterprise">Enterprise</option>
                    </Select>
                  </Field>
                </CardContent>
                <CardFooter className="text-xs text-text-subtle">
                  default · focus · error · disabled 상태를 갖춘 Field 프리미티브
                </CardFooter>
              </Card>
              <Card>
                <CardContent className="space-y-4">
                  <Field label="CORS Origins" htmlFor="d-textarea" hint="줄바꿈/쉼표로 구분">
                    <Textarea id="d-textarea" placeholder="https://app.example.com" />
                  </Field>
                  <Field label="잠긴 필드" htmlFor="d-disabled" hint="secret 키는 재조회 불가">
                    <Input id="d-disabled" defaultValue="sk_•••••••••••" disabled />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Checkbox id="d-check" defaultChecked />
                    <Label htmlFor="d-check" className="mb-0">
                      웹훅 사용
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id={switchId} />
                    <Label htmlFor={switchId} className="mb-0">
                      배지 제거 (유료)
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">탭</h3>
            <Card>
              <CardContent>
                <Tabs defaultValue="usage">
                  <TabsList>
                    <TabsTrigger value="usage">사용량</TabsTrigger>
                    <TabsTrigger value="keys">API 키</TabsTrigger>
                    <TabsTrigger value="billing">빌링</TabsTrigger>
                  </TabsList>
                  <TabsContent value="usage" className="pt-4 text-sm text-text-muted">
                    활성 탭은 하단 보더가 accent 색으로 강조됩니다.
                  </TabsContent>
                  <TabsContent value="keys" className="pt-4 text-sm text-text-muted">
                    publishable/secret 키와 회전이 여기에 들어갑니다.
                  </TabsContent>
                  <TabsContent value="billing" className="pt-4 text-sm text-text-muted">
                    플랜 비교·업그레이드·취소가 여기에 들어갑니다.
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
                    <DialogTitle>Pro 로 업그레이드할까요?</DialogTitle>
                    <DialogDescription>
                      한도가 즉시 상향되고 DeskCloud 배지가 제거됩니다. 결제는 TEST/STUB 입니다.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost" size="sm">
                        취소
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="accent" size="sm">
                        업그레이드
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Tooltip content="새 secret 키를 발급합니다(이전 키 무효)">
                <Button variant="ghost" size="sm">
                  Tooltip (hover)
                </Button>
              </Tooltip>

              <CopyButton value="pk_live_demo" label="예시 키 복사" />
            </Demo>

            {/* Banners */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">배너 (alert/status)</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Banner tone="success">설정이 저장되었습니다.</Banner>
              <Banner tone="info">API 미응답 — 정적 폴백을 표시합니다.</Banner>
              <Banner tone="warning">저장 사용량이 한도에 근접했습니다.</Banner>
              <Banner tone="error">키가 올바르지 않습니다.</Banner>
            </div>

            {/* CodeBlock */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">코드 블록 (복사)</h3>
            <CodeBlock
              code={`import { createSurveyClient } from '@heejun/deskcloud'

const survey = createSurveyClient({
  endpoint: 'https://api.deskcloud.dev',
  publishableKey: 'pk_…',
})

const active = await survey.getActive('my-app')`}
              language="ts"
              className="max-w-2xl"
            />

            {/* Cards */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">카드</h3>
            <Card className="max-w-md">
              <CardHeader action={<StatusBadge status="active" />}>
                <CardTitle>Acme Inc.</CardTitle>
                <CardDescription>slug: acme · Pro · 갱신 2026.07.15</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-text-muted">
                Header · Content · Footer 슬롯과 헤더 action 영역을 가진 합성 카드입니다. 카드를
                중첩하지 않습니다.
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="font-mono text-xs text-text-subtle">pk_live_•••</span>
                <Button variant="ghost" size="sm">
                  관리 <ArrowUpRight className="size-3.5" />
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
                  title="아직 사용량이 없습니다"
                  description="Desk 를 임베드하고 트래픽이 들어오기 시작하면 여기에 표시됩니다."
                  action={
                    <Button size="sm" variant="accent" asChild>
                      <Link to="/catalog">Desk 둘러보기</Link>
                    </Button>
                  }
                />
                <p className="px-0.5 text-xs text-text-subtle">빈 상태는 다음 행동을 안내합니다.</p>
              </div>
            </div>
          </Section>

          <p className="border-t border-border pt-8 text-xs text-text-subtle">
            이 페이지는 DeskCloud 의 실제 토큰과 컴포넌트만 사용합니다. 그라데이션
            텍스트·글래스모피즘· 사이드 스트라이프 보더 같은 금지 패턴을 쓰지 않습니다.
          </p>
        </main>
      </div>
    </div>
  )
}
