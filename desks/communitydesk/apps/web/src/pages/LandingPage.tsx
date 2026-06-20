import {
  ArrowRight,
  Code2,
  CornerDownRight,
  Gauge,
  Lock,
  MessagesSquare,
  Moon,
  Pin,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Reveal } from '@/components/common/Reveal'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useScrolled } from '@/hooks/useScrolled'
import { API_BASE } from '@/services/api'
import { cn } from '@/utils/cn'
import { vanillaSnippet } from '@/utils/embed'

const FEATURES = [
  {
    icon: MessagesSquare,
    title: '게시판·카페·중첩 댓글',
    body: '글·중첩 댓글·이모지 반응까지. 게시판(board)과 카페(cafe) 두 종류를 한 테넌트에서.',
  },
  {
    icon: Pin,
    title: '검수 큐로 운영',
    body: '글·댓글을 숨김·고정·잠금·승인·삭제. boardSlug·상태·태그로 필터하는 운영 화면.',
  },
  {
    icon: Code2,
    title: '한 줄 임베드',
    body: 'React 컴포넌트 또는 스크립트 태그. 외부 CSS 프레임워크 0, 스코프 스타일.',
  },
  {
    icon: ShieldCheck,
    title: '서버 살균 본문',
    body: '마크다운을 서버에서 안전 HTML 로 변환. <script>·이벤트 핸들러는 전부 제거.',
  },
  {
    icon: Gauge,
    title: '멀티테넌트 · 셀프 가입',
    body: '서비스가 직접 가입해 publishable·secret 키를 받고, 테넌트별로 격리됩니다.',
  },
  {
    icon: Lock,
    title: 'SaaS · 셀프호스팅',
    body: 'PGlite 폴백으로 DB 없이 즉시 실행. Postgres 로 그대로 운영 전환.',
  },
] as const

const STATS = [
  { value: '< 1줄', label: '임베드 코드' },
  { value: '2종', label: '게시판 · 카페' },
  { value: '0개', label: 'CSS 프레임워크 의존' },
] as const

function Header() {
  const { resolved, toggle } = useTheme()
  const scrolled = useScrolled()
  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b bg-bg/80 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300',
        scrolled ? 'border-border-strong shadow-sm' : 'border-transparent'
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          aria-label="CommunityDesk 홈"
          className="group inline-flex rounded-md outline-none transition-transform duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Brand />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/sitemap">사이트맵</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/demo">위젯 데모</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/support">문의</Link>
          </Button>
          {/* 통합 회원 로그인(Firebase) — 운영자 콘솔 로그인(/login)과 별개의 추가 진입점. */}
          <MemberAuthControl />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">운영자 로그인</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/signup">셀프 가입</Link>
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
  )
}

/**
 * 히어로 제품 목업 — "떠 있는 게시판 스레드" 한 장.
 * 실제 위젯 형태(고정 핀·중첩 답글·반응)를 압축해 보여주는 라이브 미리보기.
 * 순수 토큰 기반 합성(이미지 의존 0) + 미세 부유 애니메이션.
 */
function ThreadPreview() {
  return (
    <div className="relative cd-enter [animation-delay:280ms]">
      {/* 앰비언트 앰버 아우라 — 카드 뒤에서 느리게 호흡 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 -z-10 motion-safe:[animation:cd-aura_9s_ease-in-out_infinite]"
        style={{
          background:
            'radial-gradient(42% 42% at 70% 30%, var(--color-accent-soft), transparent 70%)',
        }}
      />
      <div className="relative motion-safe:[animation:cd-float_7s_ease-in-out_infinite]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
          {/* 카드 헤더 — 게시판 칩 + 라이브 도트 */}
          <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[0.8125rem] font-medium text-text-muted">
              <MessagesSquare className="size-4 text-accent-strong" aria-hidden />
              <span>일반 게시판</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-text-subtle">
              <span className="relative grid size-2 place-items-center">
                <span
                  aria-hidden
                  className="absolute size-2 rounded-full bg-success motion-safe:[animation:cd-ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]"
                />
                <span className="size-1.5 rounded-full bg-success" />
              </span>
              실시간
            </span>
          </div>

          {/* 고정된 글 */}
          <div className="px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.6875rem] font-bold text-accent-fg"
              >
                지은
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-text">출시 노트 v2.1</span>
                  <Badge tone="accent" size="sm">
                    <Pin className="size-3" aria-hidden /> 고정
                  </Badge>
                </div>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-text-muted">
                  중첩 댓글과 반응을 추가했어요. 피드백 환영합니다 🙌
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {['👍 24', '🎉 12', '❤️ 8'].map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[0.6875rem] font-medium text-text-muted"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 중첩 답글 */}
            <div className="mt-3 ml-9 space-y-2.5 border-l border-border pl-3.5">
              <div className="flex items-start gap-2">
                <CornerDownRight
                  className="mt-0.5 size-3.5 shrink-0 text-text-subtle"
                  aria-hidden
                />
                <p className="text-[0.8125rem] leading-relaxed text-text-muted">
                  <span className="font-medium text-text">민준</span> 임베드 스니펫 한 줄로
                  끝나네요.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CornerDownRight
                  className="mt-0.5 size-3.5 shrink-0 text-text-subtle"
                  aria-hidden
                />
                <p className="text-[0.8125rem] leading-relaxed text-text-muted">
                  <span className="font-medium text-text">운영자</span> 검수 큐에서 바로
                  고정했습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 떠다니는 보조 칩 — 검수 액션 */}
        <div className="absolute -right-3 -bottom-4 hidden rounded-lg border border-border bg-surface px-3 py-2 shadow-md sm:block">
          <div className="flex items-center gap-2 text-[0.75rem] font-medium text-text">
            <ShieldCheck className="size-4 text-success" aria-hidden />
            서버 살균 완료
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  useDocumentTitle()

  const endpoint = API_BASE || 'https://community.example.com'
  const snippet = vanillaSnippet({
    publishableKey: 'pk_live_xxx',
    endpoint,
    boardSlug: 'general',
  })

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* 히어로 */}
        <section className="relative overflow-hidden">
          {/* 배경 장식: 점 그리드 + 상단 앰버 워시 (reduced-motion 무관, 정적) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_45%,transparent_100%)] opacity-[0.55] dark:opacity-40"
            style={{
              backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              color: 'var(--color-border-strong)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[60rem] max-w-[100vw] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(50% 50% at 50% 50%, var(--color-accent-soft), transparent 72%)',
            }}
          />

          <div className="mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:pt-28">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
              {/* 좌: 카피 */}
              <div className="max-w-2xl">
                <div className="cd-enter [animation-delay:40ms]">
                  <Badge tone="accent" size="sm">
                    <span className="relative mr-0.5 grid size-1.5 place-items-center">
                      <span
                        aria-hidden
                        className="absolute size-1.5 rounded-full bg-accent-strong motion-safe:[animation:cd-ping_2.6s_cubic-bezier(0,0,0.2,1)_infinite]"
                      />
                      <span className="size-1.5 rounded-full bg-accent-strong" />
                    </span>
                    임베드 커뮤니티 · 게시판 · 카페
                  </Badge>
                </div>
                <h1 className="mt-5 cd-enter [animation-delay:120ms] text-[clamp(2.4rem,6.4vw,4rem)] leading-[1.04] font-bold tracking-tight text-balance text-text">
                  내 서비스에 커뮤니티를,{' '}
                  <span className="relative whitespace-nowrap text-accent-strong">
                    한 줄로
                    <svg
                      aria-hidden
                      viewBox="0 0 240 12"
                      preserveAspectRatio="none"
                      className="absolute -bottom-1.5 left-0 h-2.5 w-full text-accent"
                    >
                      <path
                        d="M2 8C40 3 120 3 238 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>{' '}
                  붙입니다
                </h1>
                <p className="mt-6 cd-enter [animation-delay:200ms] max-w-xl text-lg leading-relaxed text-pretty text-text-muted">
                  CommunityDesk 는 멀티테넌트 게시판·카페 SaaS 입니다. publishable 키로
                  글·댓글·반응을 받고, secret 키로 고정·잠금·숨김·삭제까지 운영합니다.
                </p>
                <div className="mt-8 flex cd-enter flex-wrap items-center gap-3 [animation-delay:280ms]">
                  <Button asChild size="lg" className="group">
                    <Link to="/signup">
                      무료로 시작하기
                      <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link to="/demo">위젯 데모 보기</Link>
                  </Button>
                </div>

                {/* 신뢰 스트립 — 핵심 수치 */}
                <dl className="mt-10 cd-enter flex flex-wrap items-center gap-x-8 gap-y-4 [animation-delay:360ms]">
                  {STATS.map((s) => (
                    <div key={s.label} className="flex flex-col">
                      <dt className="sr-only">{s.label}</dt>
                      <dd className="text-2xl font-bold tracking-tight text-text">{s.value}</dd>
                      <dd className="mt-0.5 text-[0.8125rem] text-text-subtle">{s.label}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* 우: 제품 목업 */}
              <div className="relative">
                <ThreadPreview />
              </div>
            </div>
          </div>
        </section>

        {/* 기능 그리드 */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20" aria-label="주요 기능">
          <Reveal className="max-w-2xl">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-balance text-text">
              운영까지 끝내는 커뮤니티 스택
            </h2>
            <p className="mt-3 text-pretty text-text-muted">
              글을 받는 위젯부터 검수·운영 콘솔까지, 한 제품 안에 들어 있습니다.
            </p>
          </Reveal>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 70}>
                <div className="group h-full rounded-xl border border-border bg-surface p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-md">
                  <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-fg transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                    <f.icon className="size-[1.2rem]" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-text">{f.title}</h3>
                  <p className="mt-1.5 text-[0.8125rem] text-pretty text-text-muted">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 임베드 스니펫 */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-label="임베드 방법">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-balance text-text">
                한 줄이면 떠 있는 게시판
              </h2>
              <p className="mt-3 max-w-prose text-pretty text-text-muted">
                비-React 사이트는 스크립트 태그 하나로 끝납니다. React 앱이라면{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  &lt;CommunityBoard /&gt;
                </code>{' '}
                컴포넌트를 추가하세요. publishable 키만 노출하면 됩니다.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-text-muted">
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <MessagesSquare className="size-3.5" aria-hidden />
                  </span>
                  중첩 댓글 · 이모지 반응 · 정렬·태그 필터
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <ShieldCheck className="size-3.5" aria-hidden />
                  </span>
                  reduced-motion 존중 · 다크 모드 · 키보드 접근성
                </li>
              </ul>
              <div className="mt-6">
                <Button asChild variant="secondary" className="group">
                  <Link to="/signup">
                    키 발급받기
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={120} className="min-w-0">
              <CodeBlock code={snippet} language="html" />
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center shadow-sm sm:p-14">
              {/* 앰버 워시 + 점 그리드 장식 */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                  background:
                    'radial-gradient(70% 120% at 50% 0%, var(--color-accent-soft), transparent 60%)',
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(80%_80%_at_50%_50%,#000,transparent)]"
                style={{
                  backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  color: 'var(--color-border)',
                }}
              />
              <h2 className="mx-auto max-w-2xl text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold tracking-tight text-balance text-text">
                DB 없이, 지금 바로 실행
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-text-muted">
                PGlite 폴백으로 Postgres·Docker 없이 즉시 부팅됩니다. 데모 테넌트·게시판·글·댓글이
                함께 시드되어, 위젯과 검수 큐를 바로 둘러볼 수 있습니다.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" className="group">
                  <Link to="/signup">
                    셀프 가입
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/demo">위젯 데모</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-text-subtle">
            <Brand compact />
            <span>CommunityDesk</span>
          </div>
          <nav aria-label="푸터" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link to="/demo" className="text-text-muted transition-colors hover:text-text">
              위젯 데모
            </Link>
            <Link to="/sitemap" className="text-text-muted transition-colors hover:text-text">
              디자인 시스템
            </Link>
            <Link to="/signup" className="text-text-muted transition-colors hover:text-text">
              셀프 가입
            </Link>
            <Link to="/support" className="text-text-muted transition-colors hover:text-text">
              문의
            </Link>
            <Link to="/login" className="text-text-muted transition-colors hover:text-text">
              로그인
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
