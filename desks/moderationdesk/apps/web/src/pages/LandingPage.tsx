import {
  ArrowRight,
  Flag,
  Gauge,
  KeyRound,
  Moon,
  ScanText,
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { LandingPlayground } from '@/components/feature/LandingPlayground'
import { MiniBar } from '@/components/feature/MiniBar'
import { ShareButton } from '@/components/feature/ShareButton'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge, VerdictBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useReveal } from '@/hooks/useReveal'
import { serverSnippet } from '@/utils/embed'

const FEATURES = [
  {
    icon: ScanText,
    title: '규칙 기반은 항상',
    body: '금칙어·부분일치·정규식 규칙으로 모든 텍스트를 즉시 검사합니다. block · flag · review 액션.',
  },
  {
    icon: Sparkles,
    title: 'AI 보조는 선택',
    body: 'ANTHROPIC_API_KEY 가 있으면 Claude(haiku)로 독성 점수를 더해 격상. 키가 없으면 규칙만으로 완전 동작.',
  },
  {
    icon: KeyRound,
    title: '두 가지 키',
    body: 'publishable(pk_)은 브라우저에서 신고·사전검사, secret(sk_)은 서버에서 차단 결정·관리.',
  },
  {
    icon: Flag,
    title: '신고 큐',
    body: '임베드 신고 버튼이 보낸 신고를 상태(접수·검토·처리·기각)로 관리하고 메모를 남깁니다.',
  },
  {
    icon: Gauge,
    title: '멀티테넌트 · usage',
    body: '테넌트가 셀프 가입해 키를 발급받고, 테넌트별 CORS 허용목록·사용량·무료 한도를 운영합니다.',
  },
  {
    icon: Server,
    title: 'SaaS · 셀프호스팅',
    body: 'PGlite 폴백으로 DB 없이 즉시 실행. Postgres 로 그대로 운영 전환. SDK·위젯 의존성 최소.',
  },
] as const

const STEPS = [
  {
    n: '01',
    title: '셀프 가입 · 키 발급',
    body: '가입하면 pk_(브라우저)·sk_(서버) 두 키를 즉시 발급. secret 은 한 번만 노출됩니다.',
  },
  {
    n: '02',
    title: '규칙 정의',
    body: '금칙어·정규식 규칙에 block/flag/review 액션을 지정. 대시보드에서 바로 테스트.',
  },
  {
    n: '03',
    title: '검사 · 신고 연동',
    body: '서버에서 md.moderate(text) 로 게이트, 브라우저엔 신고 버튼·사전검사 배지를 임베드.',
  },
] as const

function Header() {
  const { resolved, toggle } = useTheme()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
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
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">로그인</Link>
          </Button>
          <Button asChild variant="accent" size="sm">
            <Link to="/signup">무료로 시작</Link>
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

/** 히어로 배경 — 떠다니는 크림슨 글로우 2개(장식, aria-hidden). reduced-motion 시 정지. */
function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="anim-drift absolute -top-32 -left-24 size-[34rem] rounded-full bg-accent/18 blur-3xl" />
      <div className="anim-float absolute -top-10 right-[-6rem] size-[26rem] rounded-full bg-warning/12 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.5] dark:opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, var(--color-border-strong) 1px, transparent 0)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)',
        }}
      />
    </div>
  )
}

export default function LandingPage() {
  useDocumentTitle()
  const revealRef = useReveal<HTMLDivElement>()

  const endpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    'https://moderate.example.com'
  const snippet = serverSnippet({ endpoint })

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* ── 히어로 ── */}
        <section className="relative isolate overflow-hidden">
          <HeroBackdrop />
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:pb-20">
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
              {/* 좌: 카피 + CTA */}
              <div>
                <span className="anim-enter-up inline-flex" data-delay="1">
                  <Badge tone="accent" size="sm">
                    <Zap className="size-3" aria-hidden />
                    콘텐츠 모더레이션 인프라
                  </Badge>
                </span>
                <h1
                  className="anim-enter-up mt-5 text-[clamp(2.3rem,6vw,3.8rem)] leading-[1.04] font-semibold tracking-tight text-balance text-text"
                  data-delay="2"
                >
                  유해 콘텐츠를,
                  <br />
                  <span className="text-gradient-accent">API 한 번</span>으로 거릅니다
                </h1>
                <p
                  className="anim-enter-up mt-5 max-w-xl text-lg text-pretty text-text-muted"
                  data-delay="3"
                >
                  멀티테넌트 콘텐츠 모더레이션 SaaS. 금칙어·정규식 규칙은 항상, Claude AI 독성
                  점수는 선택. publishable 키로 브라우저에서 신고·사전검사하고, secret 키로 서버에서
                  차단을 결정합니다.
                </p>
                <div
                  className="anim-enter-up mt-8 flex flex-wrap items-center gap-3"
                  data-delay="4"
                >
                  <Button asChild size="lg" variant="accent">
                    <Link to="/signup">
                      키 발급받기 <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link to="/demo">위젯 체험하기</Link>
                  </Button>
                </div>
                <p className="anim-enter-up mt-4 text-sm text-text-subtle" data-delay="5">
                  가입 없이 둘러보려면 데모 키(
                  <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                    sk_demo
                  </code>
                  )로{' '}
                  <Link to="/login" className="font-medium text-accent-strong hover:text-accent">
                    로그인
                  </Link>
                  할 수 있습니다.
                </p>
              </div>

              {/* 우: 인터랙티브 라이브 플레이그라운드 */}
              <div className="anim-enter-fade lg:justify-self-end" data-delay="3">
                <LandingPlayground endpoint={endpoint} />
              </div>
            </div>

            {/* 신뢰 스트립 — verdict 범례 */}
            <div
              className="anim-enter-fade mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/70 pt-6 text-sm text-text-subtle"
              data-delay="5"
            >
              <span className="font-medium text-text-muted">판정 한눈에</span>
              <span className="flex items-center gap-2">
                <VerdictBadge verdict="allow" size="sm" /> 통과
              </span>
              <span className="flex items-center gap-2">
                <VerdictBadge verdict="flag" size="sm" /> 검토 격상
              </span>
              <span className="flex items-center gap-2">
                <VerdictBadge verdict="block" size="sm" /> 즉시 차단
              </span>
              <span className="ml-auto hidden items-center gap-1.5 sm:flex">
                <ShieldCheck className="size-4 text-accent-strong" aria-hidden />
                우선순위 block &gt; flag &gt; allow
              </span>
            </div>
          </div>
        </section>

        {/* 이하 스크롤 리빌 영역 */}
        <div ref={revealRef}>
          {/* ── 기능 그리드 ── */}
          <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="주요 기능">
            <div className="mb-8 max-w-2xl" data-reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl">
                규칙은 항상, AI 는 선택. 둘 다 한 API 에.
              </h2>
              <p className="mt-3 text-pretty text-text-muted">
                키 없이도 규칙 기반으로 완전 동작합니다. 필요할 때 Claude 독성 점수를 더해 검토를
                격상하세요 — 차단은 언제나 명시 규칙의 권한입니다.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  data-reveal
                  style={{ transitionDelay: `${(i % 3) * 70}ms` }}
                  className="hover-lift group rounded-xl border border-border bg-surface p-5"
                >
                  <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-strong transition-transform duration-200 group-hover:scale-110">
                    <f.icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-text">{f.title}</h3>
                  <p className="mt-1.5 text-[0.8125rem] text-pretty text-text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 작동 방식(3단계) ── */}
          <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="작동 방식">
            <h2
              className="mb-8 max-w-2xl text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl"
              data-reveal
            >
              3단계로 콘텐츠 게이트 연결
            </h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li
                  key={s.n}
                  data-reveal
                  style={{ transitionDelay: `${i * 80}ms` }}
                  className="relative rounded-xl border border-border bg-surface p-6"
                >
                  <span className="font-mono text-3xl font-semibold text-accent-strong/30">
                    {s.n}
                  </span>
                  <h3 className="mt-2 text-base font-semibold text-text">{s.title}</h3>
                  <p className="mt-1.5 text-[0.8125rem] text-pretty text-text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ── 서버 스니펫 + 분포 ── */}
          <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="통합 방법">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div data-reveal>
                <h2 className="text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl">
                  서버 한 줄로 콘텐츠 게이트
                </h2>
                <p className="mt-3 max-w-prose text-pretty text-text-muted">
                  서버에서는 secret 키로{' '}
                  <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                    md.moderate(text)
                  </code>{' '}
                  를 호출해 게시 전에 차단을 결정합니다. 규칙 기반은 항상, AI 보조는 키가 있으면
                  자동 적용됩니다.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-text-muted">
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-accent-strong" aria-hidden />
                    verdict: allow · flag · block — 매칭 중 가장 강한 액션 채택
                  </li>
                  <li className="flex items-center gap-2">
                    <Flag className="size-4 text-accent-strong" aria-hidden />
                    브라우저에는 신고 버튼 위젯(pk) · 작성 중 사전검사 배지
                  </li>
                </ul>
                <div className="mt-6">
                  <Button asChild variant="secondary">
                    <Link to="/signup">
                      시작하기 <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div data-reveal style={{ transitionDelay: '90ms' }}>
                <CodeBlock code={snippet} language="ts" />
                <div className="mt-4 rounded-xl border border-border bg-surface p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[0.8125rem] font-semibold text-text">
                      판정 분포 (예시)
                    </span>
                    <Badge tone="neutral" size="sm">
                      최근 1,000건
                    </Badge>
                  </div>
                  <MiniBar
                    rows={[
                      { label: '허용 (allow)', count: 812, tone: 'success' },
                      { label: '주의 (flag)', count: 64, tone: 'warning' },
                      { label: '차단 (block)', count: 124, tone: 'danger' },
                    ]}
                    total={1000}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── 최종 CTA ── */}
          <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div
              data-reveal
              className="relative isolate overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center sm:p-14"
            >
              <div
                className="pointer-events-none absolute inset-0 -z-10 opacity-90"
                aria-hidden
                style={{
                  background:
                    'radial-gradient(ellipse 60% 80% at 50% -10%, var(--color-accent-soft), transparent 70%)',
                }}
              />
              <span className="relative mx-auto grid size-12 place-items-center rounded-xl bg-accent-soft text-accent-strong">
                <span
                  className="anim-pulse-ring absolute inset-0 rounded-xl bg-accent/40"
                  aria-hidden
                />
                <ShieldCheck className="relative size-6" aria-hidden />
              </span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl">
                DB 없이 지금 바로 실행
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-text-muted">
                PGlite 폴백으로 Postgres·Docker 없이 즉시 부팅됩니다. 데모 테넌트와 샘플
                규칙·신고·로그가 함께 시드되어, 대시보드를 바로 둘러볼 수 있습니다.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" variant="accent">
                  <Link to="/signup">
                    무료로 시작 <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <ShareButton
                  size="lg"
                  title="ModerationDesk — 콘텐츠 모더레이션 as a Service"
                  text="금칙어·정규식 규칙은 항상, Claude AI 독성 점수는 선택. publishable 키로 검사·신고, secret 키로 관리."
                  label="공유하기"
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ── 푸터 ── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-text-subtle">
            <Brand compact />
            <span>ModerationDesk</span>
          </div>
          <nav aria-label="푸터" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link to="/signup" className="text-text-muted hover:text-text">
              무료로 시작
            </Link>
            <Link to="/demo" className="text-text-muted hover:text-text">
              위젯 데모
            </Link>
            <Link to="/sitemap" className="text-text-muted hover:text-text">
              디자인 시스템
            </Link>
            <Link to="/support" className="text-text-muted hover:text-text">
              문의
            </Link>
            <Link to="/login" className="text-text-muted hover:text-text">
              로그인
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
