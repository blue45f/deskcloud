import {
  Activity,
  ArrowRight,
  Code2,
  Eye,
  MessageSquareText,
  Moon,
  Server,
  ShieldCheck,
  Sun,
  Users,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Reveal } from '@/components/common/Reveal'
import { ChatPreview } from '@/components/feature/ChatPreview'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { vanillaSnippet } from '@/utils/embed'

/** 신뢰 지표 — 히어로 아래 통계 띠. */
const STATS = [
  { value: '< 50ms', label: '메시지 왕복 지연' },
  { value: '1줄', label: '임베드 설치' },
  { value: '0', label: '외부 CSS 의존성' },
  { value: '∞', label: '테넌트 · 대화방' },
] as const

/** 기능 — 벤토 레이아웃. span 으로 크기를 달리해 균일 카드 그리드를 깬다. */
const FEATURES = [
  {
    icon: MessageSquareText,
    title: '1:1 DM · 그룹 채팅',
    body: '쪽지형 1:1 DM 과 다인 그룹/룸을 한 API 로. 같은 멤버쌍 DM 은 자동 dedupe 됩니다.',
    span: 'lg:col-span-2',
  },
  {
    icon: Activity,
    title: '실시간 한 묶음',
    body: '타이핑·읽음·presence·unread 를 socket.io 로 즉시 동기화합니다.',
    span: '',
  },
  {
    icon: Users,
    title: '멀티테넌트 키',
    body: '테넌트마다 pk·sk 발급. 브라우저는 pk + memberId, 서버는 sk 로 격리합니다.',
    span: '',
  },
  {
    icon: ShieldCheck,
    title: '시스템 발송 · 모더레이션',
    body: 'sk 로 대화 생성·공지(시스템) 발송·soft delete 모더레이션을 어드민에서 처리합니다.',
    span: 'lg:col-span-2',
  },
  {
    icon: Code2,
    title: '한 줄 임베드 위젯',
    body: '스크립트 태그 하나 또는 React 컴포넌트 한 줄. 의존성 최소.',
    span: '',
  },
  {
    icon: Server,
    title: 'SaaS · 셀프호스팅',
    body: 'PGlite 폴백으로 DB 없이 즉시 실행. Postgres 로 그대로 운영 전환합니다.',
    span: 'lg:col-span-2',
  },
] as const

function Header() {
  const { resolved, toggle } = useTheme()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="transition-transform hover:scale-[1.02]" aria-label="ChatDesk 홈">
          <Brand />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/sitemap">사이트맵</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/support">문의</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">어드민 로그인</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/signup">가입</Link>
          </Button>
          {/* 회원 로그인(Firebase: 이메일/비번 + 게스트) — 어드민 콘솔 로그인과 별개. */}
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

export default function LandingPage() {
  useDocumentTitle()

  const endpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    'https://chat.example.com'
  const snippet = vanillaSnippet({ publishableKey: 'pk_데모키', endpoint, memberId: 'alice' })

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* ── 히어로 ── */}
        <section className="relative overflow-hidden">
          {/* 장식 배경 — 떠다니는 앰버 글로우 + 도트 그리드. 모두 aria-hidden, CLS 없음. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="animate-aura absolute -top-32 -right-24 size-[34rem] rounded-full bg-accent/20 blur-3xl" />
            <div
              className="animate-aura absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-accent-strong/15 blur-3xl"
              style={{ animationDelay: '-7s' }}
            />
            <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,#000_30%,transparent_72%)] bg-[radial-gradient(var(--color-border-strong)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-12 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20">
            {/* 카피 */}
            <div className="max-w-2xl">
              <div className="animate-enter-up">
                <Badge tone="accent" size="sm" dot>
                  임베드 채팅 · 실시간 메시징 인프라
                </Badge>
              </div>
              <h1
                className="animate-enter-up mt-5 text-[clamp(2.4rem,6.2vw,4rem)] leading-[1.04] font-semibold tracking-tight text-balance text-text"
                style={{ animationDelay: '60ms' }}
              >
                제품 안의 채팅을,{' '}
                <span className="relative whitespace-nowrap text-accent-strong">
                  한 줄로
                  <svg
                    aria-hidden
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1 left-0 h-2.5 w-full text-accent"
                  >
                    <path
                      d="M2 8 C50 2 150 2 198 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>{' '}
                띄웁니다
              </h1>
              <p
                className="animate-enter-up mt-6 max-w-xl text-lg text-pretty text-text-muted"
                style={{ animationDelay: '120ms' }}
              >
                ChatDesk 는 멀티테넌트 메시징 SaaS 입니다. 1:1 쪽지 DM 과 그룹 채팅을 임베드
                위젯으로 붙이고, 타이핑·읽음·presence·unread 를 실시간으로 동기화합니다.
              </p>
              <div
                className="animate-enter-up mt-8 flex flex-wrap items-center gap-3"
                style={{ animationDelay: '180ms' }}
              >
                <Button asChild size="lg" className="group accent-ring">
                  <Link to="/signup">
                    무료로 시작하기
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/login">어드민 로그인</Link>
                </Button>
              </div>
              <p
                className="animate-enter-up mt-4 flex items-center gap-1.5 text-[0.8125rem] text-text-subtle"
                style={{ animationDelay: '220ms' }}
              >
                <Zap className="size-3.5 text-accent-strong" aria-hidden />
                신용카드 불필요 · Postgres·Docker 없이 즉시 실행
              </p>
            </div>

            {/* 제품 비주얼 */}
            <div
              className="animate-enter-fade relative flex justify-center lg:justify-end"
              style={{ animationDelay: '260ms' }}
            >
              <ChatPreview />
            </div>
          </div>

          {/* 통계 띠 */}
          <Reveal
            className="mx-auto max-w-6xl px-4 pb-14 sm:px-6"
            aria-label="ChatDesk 지표"
            as="section"
          >
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="bg-surface px-5 py-5 text-center transition-colors hover:bg-surface-2"
                >
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-2xl font-semibold tracking-tight text-text tabular-nums">
                    {s.value}
                  </dd>
                  <p className="mt-1 text-xs text-text-muted">{s.label}</p>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* ── 기능 벤토 ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="주요 기능">
          <Reveal className="mb-9 max-w-2xl">
            <h2 className="text-[clamp(1.6rem,3.5vw,2.2rem)] font-semibold tracking-tight text-balance text-text">
              메시징에 필요한 모든 것, 한 인프라에
            </h2>
            <p className="mt-3 text-pretty text-text-muted">
              실시간 전송부터 멀티테넌트 격리·모더레이션까지. 백엔드를 새로 쌓지 않고 제품에 바로
              붙입니다.
            </p>
          </Reveal>
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80} className={f.span}>
                <article className="group h-full rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-md">
                  <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-fg transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                    <f.icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-[0.95rem] font-semibold text-text">{f.title}</h3>
                  <p className="mt-1.5 text-[0.8125rem] text-pretty text-text-muted">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── 임베드 스니펫 ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="임베드 방법">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <h2 className="text-[clamp(1.6rem,3.5vw,2.2rem)] font-semibold tracking-tight text-balance text-text">
                한 줄이면 떠 있는 채팅 위젯
              </h2>
              <p className="mt-3 max-w-prose text-pretty text-text-muted">
                비-React 사이트는 스크립트 태그 하나로 끝납니다. React 앱이라면{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  &lt;ChatWidget /&gt;
                </code>{' '}
                컴포넌트를 추가하세요. 브라우저에는 publishable 키(pk_…)만 노출됩니다.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-text-muted">
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <Activity className="size-3.5" aria-hidden />
                  </span>
                  타이핑 · 읽음 리시트 · presence · unread 실시간 동기화
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <ShieldCheck className="size-3.5" aria-hidden />
                  </span>
                  Origin allowlist · 멤버 범위 검증 · sk 서버 전용
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <Eye className="size-3.5" aria-hidden />
                  </span>
                  어드민에서 대화·사용량 모니터 · 시스템 발송 · 모더레이션
                </li>
              </ul>
              <div className="mt-7">
                <Button asChild variant="secondary" className="group">
                  <Link to="/signup">
                    임베드 시작하기
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <CodeBlock code={snippet} language="html" />
            </Reveal>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center sm:p-14">
              <div
                aria-hidden
                className="animate-aura pointer-events-none absolute -top-24 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
              />
              <div className="relative">
                <h2 className="text-[clamp(1.7rem,4vw,2.5rem)] font-semibold tracking-tight text-balance text-text">
                  DB 없이 지금 바로 실행
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-pretty text-text-muted">
                  PGlite 폴백으로 Postgres·Docker 없이 즉시 부팅됩니다. 데모 테넌트와 DM·그룹 대화가
                  함께 시드되어, 어드민과 위젯을 바로 둘러볼 수 있습니다.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Button asChild size="lg" className="group accent-ring">
                    <Link to="/signup">
                      무료로 시작하기
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link to="/sitemap">사이트맵</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── 푸터 ── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-text-subtle">
            <Brand compact />
            <span>ChatDesk</span>
          </div>
          <nav aria-label="푸터" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link to="/signup" className="text-text-muted transition-colors hover:text-text">
              가입
            </Link>
            <Link to="/sitemap" className="text-text-muted transition-colors hover:text-text">
              디자인 시스템
            </Link>
            <Link to="/support" className="text-text-muted transition-colors hover:text-text">
              문의
            </Link>
            <Link to="/login" className="text-text-muted transition-colors hover:text-text">
              어드민 로그인
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
