import {
  ArrowRight,
  Bell,
  Gauge,
  Inbox,
  KeyRound,
  Lock,
  Mail,
  Moon,
  Send,
  Sun,
  Zap,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { HeroInboxDemo } from '@/components/feature/HeroInboxDemo'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { useCountUp } from '@/hooks/useCountUp'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useReveal } from '@/hooks/useReveal'
import { ShareButton } from '@/lib/share'
import { apiBaseUrl } from '@/services/api'
import { cn } from '@/utils/cn'
import { reactSnippet } from '@/utils/embed'

/* ──────────────────────────────────────────────────────────────────────────
   랜딩 — NotifyDesk 의 첫인상. 제품(레스트레인드) 토큰을 그대로 쓰되, 이 한 화면만은
   브랜드 레지스터로 끌어올린다: 오케스트레이션된 진입 모션 · 스크롤 리빌 · 라이브 제품
   비네트 · 마이크로 인터랙션. 새 색은 만들지 않는다(강조 램프 + 글로우/그라데이션만).
   ────────────────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Send,
    title: '한 줄 발송',
    body: '@notifydesk/sdk 로 서버에서 notify(recipientId, …) 한 줄. 템플릿 렌더 또는 애드혹.',
    wide: true,
  },
  {
    icon: KeyRound,
    title: '셀프 가입 · 키쌍',
    body: 'pk_ 는 브라우저 안전, sk_ 는 서버 전용(해시 저장).',
  },
  {
    icon: Inbox,
    title: '인박스 벨 위젯',
    body: '<NotificationBell> — 미읽음 배지·드롭다운·읽음 처리. 의존성은 react 뿐.',
  },
  {
    icon: Bell,
    title: '다채널',
    body: 'in-app(항상)·email(SMTP/콘솔)·web-push(VAPID). 채널별 on/off.',
  },
  {
    icon: Gauge,
    title: '멀티테넌트 · 캡',
    body: '테넌트별 CORS 허용목록·사용량 카운터·free 플랜 소프트 캡.',
  },
  {
    icon: Lock,
    title: 'SaaS · 셀프호스팅',
    body: 'PGlite 폴백으로 DB 없이 즉시 실행. Postgres 로 그대로 운영 전환.',
  },
] as const

const STATS = [
  { value: 3, suffix: '채널', label: 'in-app · email · web-push' },
  { value: 1, prefix: '', suffix: '줄', label: 'notify() 한 줄 발송' },
  { value: 0, suffix: '', label: 'DB 없이 즉시 부팅 (PGlite)', literal: '0' },
] as const

function Header() {
  const { resolved, toggle } = useTheme()
  const reveal = useReveal<HTMLElement>()
  return (
    <header
      ref={reveal}
      className="reveal sticky top-0 z-30 border-b border-border/80 bg-bg/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="rounded-md transition-transform hover:scale-[1.02]"
          aria-label="NotifyDesk 홈"
        >
          <Brand />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/sitemap">사이트맵</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/demo">위젯 데모</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/support">문의</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/login">로그인</Link>
          </Button>
          <Button asChild size="sm" className="group">
            <Link to="/signup">
              시작하기
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <MemberAuthControl />
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
  )
}

function StatItem({ stat }: { stat: (typeof STATS)[number] }) {
  const [value, ref] = useCountUp(stat.value, 1100)
  const display = 'literal' in stat && stat.literal !== undefined ? stat.literal : value
  return (
    <div className="text-center sm:text-left">
      <p className="text-3xl font-semibold tracking-tight tabular-nums text-text sm:text-4xl">
        <span ref={ref}>{display}</span>
        {stat.suffix ? (
          <span className="ml-1 text-lg font-medium text-accent-strong sm:text-xl">
            {stat.suffix}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-[0.8125rem] text-text-muted">{stat.label}</p>
    </div>
  )
}

function FeatureGrid() {
  const reveal = useReveal<HTMLUListElement>()
  return (
    <ul
      ref={reveal}
      className="reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="주요 기능"
    >
      {FEATURES.map((f, i) => (
        <li
          key={f.title}
          style={{ '--i': i } as React.CSSProperties}
          className={cn(
            'group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-border-strong hover:shadow-lg',
            'wide' in f && f.wide ? 'sm:col-span-2 lg:col-span-1 lg:row-span-1' : ''
          )}
        >
          {/* hover 시 떠오르는 강조 글로우(토큰 색, 작은 영역에 한정). */}
          <span
            className="pointer-events-none absolute -top-16 -right-16 size-32 rounded-full bg-accent-soft opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-70"
            aria-hidden
          />
          <div className="relative grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-fg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
            <f.icon className="size-5" aria-hidden />
          </div>
          <h3 className="relative mt-4 text-sm font-semibold text-text">{f.title}</h3>
          <p className="relative mt-1.5 text-[0.8125rem] text-pretty text-text-muted">{f.body}</p>
        </li>
      ))}
    </ul>
  )
}

function EmbedSection({ snippet }: { snippet: string }) {
  const reveal = useReveal()
  return (
    <div ref={reveal} className="reveal grid items-center gap-10 lg:grid-cols-2">
      <div>
        <h2 className="text-[clamp(1.5rem,3.5vw,2rem)] font-semibold tracking-tight text-balance text-text">
          인박스 벨은 한 컴포넌트
        </h2>
        <p className="mt-3 max-w-prose text-pretty text-text-muted">
          React 앱이라면{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
            &lt;NotificationBell /&gt;
          </code>{' '}
          한 줄. 비-React 사이트는 스크립트 태그로 끝납니다. 벨은 publishable 키로 자기 인박스만
          읽고, 발송은 서버에서 secret 키로 합니다.
        </p>
        <ul className="mt-5 space-y-2.5 text-sm text-text-muted">
          {[
            { icon: Inbox, text: '미읽음 배지 폴링 · 접근성 드롭다운 · Esc/포커스 트랩' },
            { icon: Bell, text: 'reduced-motion 존중 · 다크 모드 · 강조색 커스터마이즈' },
            { icon: Zap, text: '코드 분할 + PWA 앱셸 — 빠른 첫 페인트, 오프라인 폴백' },
          ].map((row) => (
            <li key={row.text} className="flex items-center gap-2.5">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                <row.icon className="size-3.5" aria-hidden />
              </span>
              {row.text}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Button asChild variant="secondary" className="group">
            <Link to="/signup">
              키 발급받고 임베드하기
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
      <div className="relative">
        {/* 코드 블록 뒤 옅은 강조 글로우로 깊이. */}
        <span
          className="pointer-events-none absolute -inset-4 -z-10 rounded-2xl bg-accent-soft opacity-40 blur-2xl"
          aria-hidden
        />
        <CodeBlock code={snippet} language="tsx" />
      </div>
    </div>
  )
}

export default function LandingPage() {
  useDocumentTitle()
  const navigate = useNavigate()

  const snippet = reactSnippet({
    publishableKey: 'pk_live_xxx',
    endpoint: apiBaseUrl(),
    recipientId: 'user_42',
  })

  // 파워유저 단축키 — 입력 필드 바깥에서 'S' 누르면 가입으로. 트러스트 라인에 안내된다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (typing) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        navigate('/signup')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* ── 히어로 ── */}
        <section className="relative overflow-hidden">
          {/* 앰비언트 배경: 드리프트하는 강조 글로우 + 마스크된 격자(레이아웃 비유발). */}
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="hero-grid absolute inset-0" />
            <div
              className="absolute -top-32 left-1/2 h-[34rem] w-[44rem] -translate-x-1/2 rounded-full blur-3xl [animation:aurora-drift_14s_ease-in-out_infinite]"
              style={{ background: 'var(--hero-glow-1)' }}
            />
            <div
              className="absolute top-10 -right-24 h-80 w-80 rounded-full blur-3xl [animation:aurora-drift_18s_ease-in-out_-4s_infinite]"
              style={{ background: 'var(--hero-glow-2)' }}
            />
            <div
              className="absolute top-24 -left-24 h-72 w-72 rounded-full blur-3xl [animation:aurora-drift_16s_ease-in-out_-8s_infinite]"
              style={{ background: 'var(--hero-glow-3)' }}
            />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            {/* 좌: 오케스트레이션된 카피 진입 */}
            <div className="max-w-2xl">
              <div className="anim-rise" style={{ '--i': 0 } as React.CSSProperties}>
                <Badge tone="accent" size="sm">
                  <Sparkle /> Notifications-as-a-Service
                </Badge>
              </div>
              <h1
                className="anim-rise mt-5 text-[clamp(2.3rem,6vw,3.75rem)] leading-[1.04] font-semibold tracking-tight text-balance text-text"
                style={{ '--i': 1 } as React.CSSProperties}
              >
                알림을{' '}
                <span className="relative whitespace-nowrap">
                  한 줄
                  <AccentUnderline />
                </span>
                로 보내고,
                <br className="hidden sm:block" /> 인박스로 받습니다
              </h1>
              <p
                className="anim-rise mt-5 max-w-xl text-lg text-pretty text-text-muted"
                style={{ '--i': 2 } as React.CSSProperties}
              >
                NotifyDesk 는 외부 온보딩형(멀티테넌트) 알림 인프라입니다. 셀프 가입으로
                publishable/secret 키를 받고, 서버에서 알림을 보내면 사용자 인박스 벨에 쌓입니다.
                in-app · email · web-push.
              </p>
              <div
                className="anim-rise mt-8 flex flex-wrap items-center gap-3"
                style={{ '--i': 3 } as React.CSSProperties}
              >
                <Button asChild size="lg" className="group relative overflow-hidden">
                  <Link to="/signup">
                    {/* 버튼 위로 지나가는 shine(hover). */}
                    <span
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                      aria-hidden
                    />
                    무료로 시작하기
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/demo">위젯 데모 보기</Link>
                </Button>
              </div>
              <p
                className="anim-rise mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-subtle"
                style={{ '--i': 4 } as React.CSSProperties}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" aria-hidden /> 신용카드 불필요
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-3.5" aria-hidden /> secret 키는 해시 저장
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Gauge className="size-3.5" aria-hidden /> free 플랜 소프트 캡
                </span>
                <span className="hidden items-center gap-1.5 sm:inline-flex">
                  <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-text-muted">
                    S
                  </kbd>
                  눌러 바로 가입
                </span>
              </p>
            </div>

            {/* 우: 라이브 제품 비네트 */}
            <div className="anim-rise lg:pl-4" style={{ '--i': 2 } as React.CSSProperties}>
              <HeroInboxDemo />
            </div>
          </div>

          {/* 프루프 바 — 히어로 메트릭 템플릿(거대 숫자 1개)이 아니라, 동률 3지표 + 카운트업. */}
          <div className="border-y border-border bg-surface/40">
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-7 sm:grid-cols-3 sm:px-6">
              {STATS.map((s) => (
                <StatItem key={s.label} stat={s} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 기능 그리드 ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-[clamp(1.6rem,4vw,2.25rem)] font-semibold tracking-tight text-balance text-text">
              발송부터 인박스까지, 끝까지 책임집니다
            </h2>
            <p className="mt-3 text-pretty text-text-muted">
              키 발급 · 다채널 디스패치 · 수신자 인박스 · 선호 게이팅 · 멀티테넌트 격리까지 한
              파이프라인으로. 필요한 건 한 번의 가입뿐입니다.
            </p>
          </div>
          <FeatureGrid />
        </section>

        {/* ── 임베드 ── */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-label="임베드 방법">
          <EmbedSection snippet={snippet} />
        </section>

        {/* ── 마무리 CTA ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <FinalCta />
        </section>
      </main>

      <Footer />
    </div>
  )
}

/** 강조 underline — 그라데이션 텍스트 대신, 단어 아래로 흐르는 강조 바(accent-pan). */
function AccentUnderline() {
  return (
    <span
      className="accent-pan absolute -bottom-1 left-0 h-[0.18em] w-full rounded-full"
      aria-hidden
    />
  )
}

/** 배지 안 작은 펄스 점. */
function Sparkle() {
  return (
    <span className="relative mr-0.5 inline-flex size-1.5" aria-hidden>
      <span className="absolute inline-flex size-full rounded-full bg-accent-strong opacity-60 [animation:badge-pop_900ms_var(--ease-out-quint)_infinite]" />
      <span className="relative inline-flex size-1.5 rounded-full bg-accent-strong" />
    </span>
  )
}

function FinalCta() {
  const reveal = useReveal()
  return (
    <div
      ref={reveal}
      className="reveal relative overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center shadow-sm sm:p-14"
    >
      {/* 옅은 강조 글로우 두 점 — 카드 안 깊이. */}
      <span
        className="pointer-events-none absolute -top-24 left-1/4 size-64 rounded-full blur-3xl"
        style={{ background: 'var(--hero-glow-1)' }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -bottom-24 right-1/4 size-56 rounded-full blur-3xl"
        style={{ background: 'var(--hero-glow-3)' }}
        aria-hidden
      />
      <div className="relative">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-ink text-ink-fg shadow-md">
          <Bell
            className="size-6 origin-top [animation:bell-swing_6s_ease-in-out_2s_infinite]"
            aria-hidden
          />
        </span>
        <h2 className="mx-auto mt-5 max-w-xl text-[clamp(1.6rem,4vw,2.25rem)] font-semibold tracking-tight text-balance text-text">
          DB 없이, 지금 바로 첫 알림을 보내세요
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-text-muted">
          PGlite 폴백으로 Postgres·Docker 없이 즉시 부팅됩니다. 데모 테넌트(pk_demo/sk_demo)와 샘플
          인박스가 함께 시드되어, 대시보드를 바로 둘러볼 수 있습니다.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="group relative overflow-hidden">
            <Link to="/signup">
              <span
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                aria-hidden
              />
              테넌트 만들기
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <ShareButton
            title="NotifyDesk — 알림을 한 줄로 보내는 인프라"
            text="셀프 가입으로 키를 받고, 서버에서 알림을 보내면 사용자 인박스에 쌓입니다. in-app · email · web-push."
            label="공유하기"
          />
        </div>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2 text-sm text-text-subtle">
          <Brand compact />
          <span>NotifyDesk</span>
        </div>
        <nav aria-label="푸터" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {[
            { to: '/demo', label: '위젯 데모' },
            { to: '/support', label: '문의' },
            { to: '/sitemap', label: '사이트맵' },
            { to: '/signup', label: '시작하기' },
            { to: '/login', label: '로그인' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="relative text-text-muted transition-colors hover:text-text after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-accent-strong after:transition-all after:duration-200 hover:after:w-full"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
