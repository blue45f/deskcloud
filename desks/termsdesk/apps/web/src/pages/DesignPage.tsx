import {
  ArrowUpRight,
  Bell,
  Check,
  FileText,
  Inbox,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Badge, DecisionPill, PolicyTypeBadge, StatusPill } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown'
import { EmptyState, HashTag, Skeleton } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Label, Select, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/utils/cn'

/* ──────────────────────────────────────────────────────────────────────────
   라이브 스타일 가이드 — 이 프로젝트의 실제 토큰(styles/index.css)과
   components/ui 컴포넌트를 그대로 보여 준다. 새 팔레트를 만들지 않는다.
   ────────────────────────────────────────────────────────────────────────── */

const NAV = [
  { id: 'foundations', label: '기초' },
  { id: 'color', label: '색상' },
  { id: 'typography', label: '타이포그래피' },
  { id: 'space', label: '간격·반경·그림자' },
  { id: 'motion', label: '모션' },
  { id: 'components', label: '컴포넌트' },
] as const

/** getComputedStyle 으로 토큰을 즉시 해석한다. 테마 토글마다 다시 읽도록 nonce 의존. */
function useResolvedToken(cssVar: string, nonce: number): string {
  const [value, setValue] = useState('')
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
    setValue(raw)
  }, [cssVar, nonce])
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

/** 한 컴포넌트 데모 + 상태 캡션. */
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
  nonce,
  className,
}: {
  cssVar: string
  name: string
  nonce: number
  className?: string
}) {
  const resolved = useResolvedToken(cssVar, nonce)
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
  // 테마가 바뀔 때마다 토큰을 다시 해석하기 위한 nonce.
  const [nonce, setNonce] = useState(0)
  useEffect(() => setNonce((n) => n + 1), [resolved])

  const [active, setActive] = useState<string>(NAV[0].id)
  const switchId = useId()
  const motionRef = useRef<HTMLDivElement>(null)
  const [demoLoading, setDemoLoading] = useState(false)

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
    // reflow 강제 후 재시작 (prefers-reduced-motion 은 전역 규칙이 무력화).
    void el.offsetWidth
    el.style.animation = ''
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <ShieldCheck className="size-5 shrink-0 text-accent-strong" aria-hidden />
            <span className="truncate text-sm font-bold tracking-tight text-text">TermsDesk</span>
            <span className="hidden text-sm text-text-subtle sm:inline">/ Design System</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">앱으로 돌아가기</Link>
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
        {/* ── 인-페이지 내비 (스티키) ── */}
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
          {/* ── 히어로 ── */}
          <div className="border-b border-border py-14">
            <Badge tone="accent" size="sm">
              살아있는 스타일 가이드
            </Badge>
            <h1 className="mt-3 max-w-[18ch] text-[clamp(2rem,5vw,3rem)] font-semibold tracking-tight text-balance text-text">
              약관 인프라를 받치는 디자인 토큰과 컴포넌트
            </h1>
            <p className="mt-4 max-w-[65ch] text-pretty text-text-muted">
              이 페이지는 TermsDesk의 실제 디자인 시스템을 그대로 렌더링합니다. 색상은{' '}
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

          {/* ── 색상 ── */}
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
                    <ColorSwatch key={t.v} cssVar={t.v} name={t.n} nonce={nonce} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-[0.8125rem] font-semibold text-text">표면 · 경계</h3>
                <div className="space-y-2.5">
                  {SURFACE_TOKENS.map((t) => (
                    <ColorSwatch key={t.v} cssVar={t.v} name={t.n} nonce={nonce} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-[0.8125rem] font-semibold text-text">텍스트 · 잉크</h3>
                <div className="space-y-2.5">
                  {TEXT_TOKENS.map((t) => (
                    <ColorSwatch key={t.v} cssVar={t.v} name={t.n} nonce={nonce} />
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
                      <ColorSwatch cssVar={s.base} name={s.n} nonce={nonce} className="size-9" />
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

          {/* ── 타이포그래피 ── */}
          <Section
            id="typography"
            eyebrow="Foundations"
            title="타이포그래피"
            intro={
              <>
                본문은 Pretendard Variable 한 가족으로 헤딩·라벨·데이터까지 운용합니다. 해시·코드는{' '}
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
                    <span className={cn('text-text', t.cls)}>약관 버전을 봉인합니다</span>
                    <span className="shrink-0 font-mono text-xs text-text-subtle">{t.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-1">
                  <span className="font-mono text-sm text-text">mono · sha256:0a1b2c3d</span>
                  <span className="font-mono text-xs text-text-subtle">--font-mono</span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="mb-2 text-xs font-semibold text-text-subtle">본문 가독폭 · 약 68ch</p>
                <p className="max-w-[68ch] text-pretty text-text-muted">
                  TermsDesk는 약관을 대신 작성하지 않습니다. 조직이 작성한 문서를 등록하고, 버전을
                  관리하며, 발효 시점과 내용 해시를 봉인해 변조를 방지합니다. 본문은 65–75ch 범위로
                  줄길이를 제한해 장문도 편안하게 읽히도록 합니다.
                </p>
              </div>
            </div>
          </Section>

          {/* ── 간격·반경·그림자 ── */}
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

          {/* ── 모션 ── */}
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
                    봉인 완료 ✓
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-xs">
                  <dt className="text-text-subtle">fade-in</dt>
                  <dd className="text-right font-mono text-text-muted">120–150ms ease-out</dd>
                  <dt className="text-text-subtle">pop-in (Dialog)</dt>
                  <dd className="text-right font-mono text-text-muted">160ms</dd>
                  <dt className="text-text-subtle">slide-in-left (Sheet)</dt>
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

          {/* ── 컴포넌트 갤러리 ── */}
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
                  게시
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
              <Demo caption="도메인 칩 — StatusPill · DecisionPill · PolicyTypeBadge">
                <StatusPill status="published" />
                <StatusPill status="draft" />
                <StatusPill status="scheduled" />
                <DecisionPill decision="accepted" />
                <DecisionPill decision="declined" />
                <PolicyTypeBadge type="terms" />
                <PolicyTypeBadge type="privacy" />
              </Demo>
            </div>

            {/* Forms */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">폼 컨트롤</h3>
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardContent className="space-y-4">
                  <Field label="문서 이름" htmlFor="d-name" hint="공개 슬러그로도 쓰입니다.">
                    <Input id="d-name" placeholder="예: 이용약관" />
                  </Field>
                  <Field label="발효일" htmlFor="d-error" error="발효일은 오늘 이후여야 합니다.">
                    <Input id="d-error" defaultValue="2020-01-01" aria-invalid />
                  </Field>
                  <Field label="문서 종류" htmlFor="d-type">
                    <Select id="d-type" defaultValue="terms">
                      <option value="terms">이용약관</option>
                      <option value="privacy">개인정보처리방침</option>
                      <option value="refund">환불·취소 정책</option>
                    </Select>
                  </Field>
                </CardContent>
                <CardFooter className="text-xs text-text-subtle">
                  default · focus · error · disabled 상태를 모두 갖춘 Field 프리미티브
                </CardFooter>
              </Card>
              <Card>
                <CardContent className="space-y-4">
                  <Field label="변경 요약" htmlFor="d-textarea" hint="발효 알림에 함께 노출됩니다.">
                    <Textarea id="d-textarea" placeholder="이번 버전에서 바뀐 점을 적어 주세요…" />
                  </Field>
                  <Field label="잠긴 필드" htmlFor="d-disabled" hint="published 버전은 수정 불가">
                    <Input id="d-disabled" defaultValue="sha256:0a1b2c3d (봉인됨)" disabled />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Checkbox id="d-check" defaultChecked />
                    <Label htmlFor="d-check" className="mb-0">
                      게시 전 변경 이력 검토 요청
                    </Label>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
                    <Label htmlFor={switchId} className="mb-0">
                      자동 봉인 (Switch)
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
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">개요</TabsTrigger>
                    <TabsTrigger value="versions">버전</TabsTrigger>
                    <TabsTrigger value="consents">동의</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="pt-4 text-sm text-text-muted">
                    활성 탭은 하단 보더가 accent 색으로 강조됩니다.
                  </TabsContent>
                  <TabsContent value="versions" className="pt-4 text-sm text-text-muted">
                    버전 타임라인과 diff 가 여기에 들어갑니다.
                  </TabsContent>
                  <TabsContent value="consents" className="pt-4 text-sm text-text-muted">
                    동의 영수증 목록이 여기에 들어갑니다.
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Overlays */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">
              오버레이 — Dialog · Dropdown · Tooltip
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
                    <DialogTitle>버전을 게시할까요?</DialogTitle>
                    <DialogDescription>
                      게시하면 내용 해시가 봉인되고 더 이상 수정할 수 없습니다.
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
                        게시
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dropdown>
                <DropdownTrigger asChild>
                  <Button variant="outline" size="sm">
                    Dropdown
                  </Button>
                </DropdownTrigger>
                <DropdownContent align="start">
                  <DropdownLabel>작업</DropdownLabel>
                  <DropdownItem>
                    <FileText className="size-4" />새 버전
                  </DropdownItem>
                  <DropdownItem>
                    <Bell className="size-4" />
                    구독자 알림
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem danger>
                    <Trash2 className="size-4" />
                    보관
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>

              <Tooltip content="내용 해시를 클립보드에 복사합니다">
                <Button variant="ghost" size="sm">
                  Tooltip (hover)
                </Button>
              </Tooltip>

              <span className="ml-1">
                <HashTag hash="0a1b2c3d4e5f6071829" />
              </span>
            </Demo>

            {/* Cards */}
            <h3 className="mt-12 mb-3 text-base font-semibold text-text">카드</h3>
            <Card className="max-w-md">
              <CardHeader action={<StatusPill status="published" />}>
                <CardTitle>이용약관</CardTitle>
                <CardDescription>v3 · 2026-06-01 발효 · 구독자 1,204명</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-text-muted">
                Header · Content · Footer 슬롯과 헤더 action 영역을 가진 합성 카드입니다. 카드를
                중첩하지 않습니다.
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <HashTag hash="0a1b2c3d4e5f6071829" />
                <Button variant="ghost" size="sm">
                  버전 보기 <ArrowUpRight className="size-3.5" />
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
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" loading onClick={() => setDemoLoading((v) => !v)}>
                        {demoLoading ? '불러오는 중' : '스켈레톤'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <p className="px-0.5 text-xs text-text-subtle">
                  스피너 대신 콘텐츠 모양의 스켈레톤으로 로딩을 알립니다.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <EmptyState
                  icon={Inbox}
                  title="아직 등록된 문서가 없습니다"
                  description="첫 약관을 등록하면 버전·발효일·해시를 한곳에서 관리할 수 있습니다."
                  action={
                    <Button size="sm" variant="accent">
                      문서 등록
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
            이 페이지는 TermsDesk의 실제 토큰과 컴포넌트만 사용합니다. 새 색·새 컴포넌트를 만들지
            않습니다.
          </p>
        </main>
      </div>
    </div>
  )
}
