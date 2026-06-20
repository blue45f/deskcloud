import {
  ArrowRight,
  Code2,
  KeyRound,
  Moon,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Users,
} from 'lucide-react'
import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { HeroShowcase } from './landing/HeroShowcase'
import { PROOF_STATS, SHOWCASE_TESTIMONIALS } from './landing/showcase'
import { TestimonialMarquee } from './landing/TestimonialMarquee'

import { useTheme } from '@/app/ThemeContext'
import { CountUp } from '@/components/common/CountUp'
import { Reveal } from '@/components/common/Reveal'
import { Stars } from '@/components/feature/Stars'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useScrolled } from '@/hooks/useScrolled'
import { cn } from '@/utils/cn'
import { vanillaSnippet } from '@/utils/embed'

const FEATURES = [
  {
    icon: Star,
    title: '4가지 임베드 위젯',
    body: '별점 배지·리뷰 목록(분포 막대)·리뷰 작성 폼·후기 월(testimonial wall). 한 줄이면 붙습니다.',
  },
  {
    icon: ShieldCheck,
    title: '검수 워크플로',
    body: '제출 → 대기 → 승인/거절. 추천(featured) 지정·운영자 답글까지. 승인본만 위젯에 노출됩니다.',
  },
  {
    icon: KeyRound,
    title: '셀프 가입 · 두 키',
    body: 'publishable 키(브라우저 안전)로 받고 노출, secret 키로 검수. 가입 즉시 발급됩니다.',
  },
  {
    icon: Users,
    title: '멀티테넌트',
    body: '외부 서비스가 직접 가입해 자기 테넌트를 운영합니다. 테넌트별 CORS·사용량·요금제 분리.',
  },
  {
    icon: MessageSquareQuote,
    title: 'subject 별 집계',
    body: '대상(product/page)별 평균 별점·건수·분포·만족도. 배지와 대시보드가 같은 집계를 공유합니다.',
  },
  {
    icon: Code2,
    title: 'SaaS · 셀프호스팅',
    body: 'PGlite 폴백으로 DB 없이 즉시 실행. Postgres 로 그대로 운영 전환. 외부 CSS 의존성 0.',
  },
] as const

const STEPS = [
  { n: '01', title: '가입', body: '서비스 이름·허용 도메인을 입력하면 pk/sk 키가 발급됩니다.' },
  { n: '02', title: '임베드', body: 'React 컴포넌트 또는 <script> 한 줄로 위젯을 붙입니다.' },
  { n: '03', title: '검수', body: '들어온 리뷰를 승인·거절·추천하고, 승인본을 위젯이 노출합니다.' },
] as const

const FOOTER_LINKS = [
  { to: '/signup', label: '가입' },
  { to: '/demo', label: '위젯 데모' },
  { to: '/sitemap', label: '사이트맵' },
  { to: '/support', label: '문의' },
  { to: '/login', label: '로그인' },
] as const

function Header() {
  const { resolved, toggle } = useTheme()
  const scrolled = useScrolled()
  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300',
        scrolled ? 'border-border-strong bg-bg/90 shadow-sm' : 'border-transparent bg-bg/70'
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="ReviewDesk 홈" className="rounded-md">
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
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">콘솔 로그인</Link>
          </Button>
          <MemberAuthControl />
          <Button asChild variant="secondary" size="sm">
            <Link to="/signup">무료로 시작</Link>
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

export default function LandingPage() {
  useDocumentTitle()

  const endpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    'https://reviews.example.com'
  const snippet = vanillaSnippet({ publishableKey: 'pk_live_xxx', endpoint, subjectId: 'pro-plan' })

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* ── 히어로 ── */}
        <section className="relative overflow-hidden">
          {/* 오로라 배경 — 느리게 패닝하는 그라데이션 + 그리드 텍스처. 순수 장식. */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
            <div
              className="absolute -top-[28%] left-1/2 h-[42rem] w-[78rem] max-w-none -translate-x-1/2 rounded-[50%] opacity-70 blur-3xl [animation:aurora-pan_22s_ease-in-out_infinite]"
              style={{
                background:
                  'radial-gradient(40% 50% at 30% 40%, var(--color-accent-soft) 0%, transparent 70%), radial-gradient(42% 52% at 72% 38%, var(--color-warning-soft) 0%, transparent 72%), radial-gradient(38% 48% at 52% 70%, var(--color-info-soft) 0%, transparent 70%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(60%_50%_at_50%_30%,black,transparent)]"
              style={{
                backgroundImage:
                  'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
                backgroundSize: '44px 44px',
              }}
            />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <span className="animate-rise-pop inline-block" style={{ animationDelay: '40ms' }}>
                <Badge tone="accent" size="sm">
                  <Sparkles className="size-3" aria-hidden /> 임베드 평점 · 리뷰 · 후기 인프라
                </Badge>
              </span>
              <h1
                className="animate-rise mt-4 text-[clamp(2.3rem,6vw,3.7rem)] leading-[1.04] font-semibold tracking-tight text-balance text-text"
                style={{ animationDelay: '90ms' }}
              >
                고객의 별점과 후기를, <span className="text-gradient-accent">내 서비스 안에서</span>
              </h1>
              <p
                className="animate-rise mt-5 max-w-2xl text-lg text-pretty text-text-muted"
                style={{ animationDelay: '170ms' }}
              >
                ReviewDesk 는 외부 서비스가 직접 가입해 쓰는 멀티테넌트 평점·리뷰·후기 수집 SaaS
                입니다. publishable 키로 리뷰를 받고 노출하고, secret 키로 검수·집계합니다. 위젯
                4종은 한 줄이면 붙습니다.
              </p>
              <div
                className="animate-rise mt-8 flex flex-wrap items-center gap-3"
                style={{ animationDelay: '250ms' } as CSSProperties}
              >
                <Button
                  asChild
                  size="lg"
                  className="group/cta shadow-sm transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Link to="/signup">
                    무료로 시작하기{' '}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Link to="/demo">위젯 데모 보기</Link>
                </Button>
              </div>
              <p
                className="animate-rise mt-4 flex items-center gap-2 text-sm text-text-subtle"
                style={{ animationDelay: '330ms' } as CSSProperties}
              >
                <Stars value={5} size="sm" />
                신용카드 없이 가입 · 가입 즉시 키 발급 · PGlite 로 DB 없이 셀프호스팅
              </p>
            </div>

            {/* 우측 히어로 쇼케이스 — 떠 있는 별점 스냅샷 카드 클러스터. */}
            <div className="relative mx-auto hidden w-full max-w-sm lg:block">
              <HeroShowcase />
            </div>
          </div>

          {/* 증명 지표 바 — 스크롤 진입 시 카운트업. */}
          <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
            <Reveal className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
              {PROOF_STATS.map((s) => (
                <div key={s.label} className="bg-surface px-5 py-5 text-center sm:py-6">
                  <p className="text-3xl font-bold tracking-tight tabular-nums text-text">
                    <CountUp
                      value={s.value}
                      decimals={s.decimals ?? 0}
                      suffix={s.suffix ?? ''}
                      className="text-gradient-accent"
                    />
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{s.label}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ── 온보딩 3단계 ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="시작 방법">
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="group h-full rounded-xl border border-border bg-surface p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
                  <span className="font-mono text-sm font-semibold text-accent-strong">{s.n}</span>
                  <h3 className="mt-2 text-sm font-semibold text-text">{s.title}</h3>
                  <p className="mt-1 text-[0.8125rem] text-pretty text-text-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── 후기 월 마키(사회적 증거) ── */}
        <section className="py-8" aria-labelledby="wall-heading">
          <div className="mx-auto mb-6 max-w-6xl px-4 sm:px-6">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="wall-heading"
                    className="text-2xl font-semibold tracking-tight text-balance text-text"
                  >
                    이미 후기로 신뢰를 쌓는 팀들
                  </h2>
                  <p className="mt-2 max-w-prose text-pretty text-text-muted">
                    승인된 후기만 골라 흐르는 후기 월(testimonial wall) 위젯. 그대로 랜딩에 붙일 수
                    있습니다.
                  </p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text">
                  <Stars value={5} size="sm" /> 4.9 / 5 평균
                </span>
              </div>
            </Reveal>
          </div>

          {/* 두 줄을 반대 방향으로 흘려 깊이감. */}
          <div className="space-y-4">
            <TestimonialMarquee durationMs={52000} />
            <TestimonialMarquee durationMs={64000} reverse className="hidden sm:block" />
          </div>

          {/* 스크린리더용 정적 후기 목록(마키는 aria-hidden). */}
          <ul className="sr-only">
            {SHOWCASE_TESTIMONIALS.map((t) => (
              <li key={t.author}>
                {t.author}, {t.role}: {t.quote} (별점 {t.rating}/5)
              </li>
            ))}
          </ul>
        </section>

        {/* ── 기능 그리드 ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="주요 기능">
          <Reveal className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-text">
              리뷰 수집부터 노출까지, 한 자리에서
            </h2>
            <p className="mt-2 text-pretty text-text-muted">
              임베드·검수·집계·게시에 필요한 것만 깔끔하게. 무거운 의존성 없이.
            </p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80}>
                <div className="group h-full rounded-xl border border-border bg-surface p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-md">
                  <div className="grid size-9 place-items-center rounded-md bg-accent-soft text-accent-fg transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6">
                    <f.icon className="size-4.5" aria-hidden />
                  </div>
                  <h3 className="mt-3.5 text-sm font-semibold text-text">{f.title}</h3>
                  <p className="mt-1 text-[0.8125rem] text-pretty text-text-muted">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── 임베드 스니펫 ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="임베드 방법">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-balance text-text">
                한 줄이면 떠 있는 별점과 후기
              </h2>
              <p className="mt-3 max-w-prose text-pretty text-text-muted">
                비-React 사이트는{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  &lt;script&gt;
                </code>{' '}
                하나로 끝납니다. React 앱이라면{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  @reviewdesk/widget
                </code>{' '}
                컴포넌트를 쓰세요. publishable 키만 넣으니 브라우저 노출도 안전합니다.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-text-muted">
                <li className="flex items-center gap-2">
                  <Star className="size-4 text-accent-strong" aria-hidden />
                  roving 별점 라디오 · focus-visible · reduced-motion 존중
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-accent-strong" aria-hidden />
                  테넌트 CORS 허용목록 · 무료 플랜 소프트 한도 · 입력 살균
                </li>
              </ul>
              <div className="mt-6">
                <Button asChild variant="secondary" className="group/snip">
                  <Link to="/signup">
                    내 키 받고 임베드하기{' '}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover/snip:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <CodeBlock code={snippet} language="html" />
            </Reveal>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center shadow-sm sm:p-14">
              {/* CTA 내부 글로우 */}
              <div
                className="pointer-events-none absolute inset-0 -z-10 opacity-80"
                aria-hidden
                style={{
                  background:
                    'radial-gradient(60% 80% at 50% 0%, var(--color-accent-soft) 0%, transparent 70%)',
                }}
              />
              <span className="float-slow mb-4 inline-grid size-11 place-items-center rounded-xl bg-accent text-accent-fg shadow-md">
                <Star className="size-5 fill-current" aria-hidden />
              </span>
              <h2 className="text-[clamp(1.5rem,3.5vw,2rem)] font-semibold tracking-tight text-balance text-text">
                지금 가입하고 첫 리뷰를 받아 보세요
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-text-muted">
                가입 즉시 publishable/secret 키와 복사용 임베드 스니펫이 나옵니다. 데모
                테넌트(pk_demo / sk_demo)로 검수 대시보드를 바로 둘러볼 수도 있습니다.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Link to="/signup">무료로 시작</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/demo">위젯 데모</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── 푸터 ── */}
      <footer className="border-t border-border">
        <Reveal className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-text-subtle">
            <Brand compact />
            <span>ReviewDesk</span>
          </div>
          <nav aria-label="푸터" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="relative text-text-muted transition-colors after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-accent-strong after:transition-[width] after:duration-200 hover:text-text hover:after:w-full"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </Reveal>
      </footer>
    </div>
  )
}
