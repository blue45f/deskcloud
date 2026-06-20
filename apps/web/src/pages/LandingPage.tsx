import {
  ArrowRight,
  BarChart3,
  Code2,
  Gauge,
  ListChecks,
  Lock,
  Moon,
  MessageSquareText,
  Star,
  Sun,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import type { CSSProperties } from 'react'

import { useTheme } from '@/app/ThemeContext'
import { HeroPreview } from '@/components/feature/HeroPreview'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useScrolled } from '@/hooks/useScrolled'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { cn } from '@/utils/cn'
import { vanillaSnippet } from '@/utils/embed'

const FEATURES = [
  {
    icon: Star,
    title: '5가지 질문 타입',
    body: '별점(1–5)·NPS(0–10)·단일/복수 선택·자유서술. 임베드 위젯이 그대로 렌더합니다.',
  },
  {
    icon: BarChart3,
    title: '바로 보는 집계',
    body: '평균 별점·NPS 점수·선택지 분포·최근 자유서술을 대시보드에서 한눈에.',
  },
  {
    icon: Code2,
    title: '한 줄 임베드',
    body: 'React 컴포넌트 또는 스크립트 태그. 외부 CSS 프레임워크 0, 의존성 최소.',
  },
  {
    icon: ListChecks,
    title: '버전·활성화',
    body: '설문을 버전으로 관리하고, appId당 활성본 1개만 위젯에 노출합니다.',
  },
  {
    icon: Gauge,
    title: '멀티테넌트',
    body: 'appId 한 값으로 형제 앱(offhours·resume…)을 분리 수집합니다.',
  },
  {
    icon: Lock,
    title: 'SaaS · 셀프호스팅',
    body: 'PGlite 폴백으로 DB 없이 즉시 실행. Postgres 로 그대로 운영 전환.',
  },
] as const

const SIBLING_APPS = ['offhours', 'resume', 'webtoon', 'pettography', 'termsdesk'] as const

function Header() {
  const { resolved, toggle } = useTheme()
  const scrolled = useScrolled(8)
  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300',
        scrolled
          ? 'border-border-strong bg-bg/90 shadow-sm supports-[backdrop-filter]:bg-bg/75'
          : 'border-border/70 bg-bg/60 supports-[backdrop-filter]:bg-bg/40'
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="SurveyDesk 홈" className="group">
          <Brand lamp className="transition-transform duration-200 group-hover:-translate-y-px" />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/sitemap">사이트맵</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/demo">위젯 데모</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/support">문의</Link>
          </Button>
          <MemberAuthControl />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">어드민 로그인</Link>
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
  const revealRef = useScrollReveal<HTMLElement>()

  const endpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    'https://surveys.example.com'
  const snippet = vanillaSnippet({ appId: 'offhours', endpoint })

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />

      <main ref={revealRef} id="main-content" tabIndex={-1} className="outline-none">
        {/* ── 히어로 ── */}
        <section className="relative overflow-hidden">
          {/* 분위기 레이어: 강조 오로라 글로우 + 점 그리드. 작은 영역에 한정, 장식. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 motion-safe:animate-[aurora-drift_14s_ease-in-out_infinite]"
            style={{
              background:
                'radial-gradient(60% 55% at 78% 8%, var(--color-accent-soft) 0%, transparent 60%), radial-gradient(45% 45% at 12% 0%, var(--color-info-soft) 0%, transparent 55%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5] [mask-image:radial-gradient(70%_60%_at_50%_0%,#000,transparent_75%)]"
            style={{
              backgroundImage: 'radial-gradient(var(--color-border-strong) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <div className="max-w-2xl">
              <div className="animate-in [--d:0ms]">
                <Badge tone="accent" size="sm">
                  <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />
                  임베드 설문 · 피드백 인프라
                </Badge>
              </div>
              <h1 className="animate-in [--d:80ms] mt-5 text-[clamp(2.4rem,6vw,3.75rem)] leading-[1.04] font-semibold tracking-[-0.03em] text-balance text-text">
                형제 앱의 피드백을,
                <br />
                <span className="relative inline-block text-accent-strong">
                  한 곳에서 모읍니다
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 h-[0.18em] w-full origin-left rounded-full bg-accent/40 motion-safe:[animation:grow-x_700ms_var(--ease-out-quint)_both] motion-safe:[animation-delay:560ms]"
                  />
                </span>
              </h1>
              <p className="animate-in [--d:160ms] mt-6 max-w-xl text-lg leading-relaxed text-pretty text-text-muted">
                SurveyDesk 는 멀티테넌트(appId) 설문·피드백 수집 SaaS 입니다. 임베드 위젯으로
                별점·NPS·객관식·자유서술을 모으고, 운영자는 평균·NPS·선택지 분포로 집계를 봅니다.
              </p>
              <div className="animate-in [--d:240ms] mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/demo">
                    위젯 체험하기{' '}
                    <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/login">대시보드 들어가기</Link>
                </Button>
              </div>

              {/* 신뢰 스트립 — 실제 형제 앱들이 수집에 쓴다는 컨텍스트 */}
              <div className="animate-in [--d:340ms] mt-10">
                <p className="text-xs font-medium tracking-wide text-text-subtle">
                  형제 앱 생태계가 한 백엔드로 피드백을 모읍니다
                </p>
                <ul className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  {SIBLING_APPS.map((app) => (
                    <li
                      key={app}
                      className="rounded-full border border-border bg-surface/70 px-3 py-1 font-mono text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text"
                    >
                      {app}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 데코 미리보기 — 모바일에선 숨김(콘텐츠 우선) */}
            <HeroPreview className="hidden lg:block" />
          </div>
        </section>

        {/* ── 기능 그리드 ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="주요 기능">
          <div className="reveal mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-text sm:text-[1.65rem]">
              수집부터 집계까지, 군더더기 없이
            </h2>
            <p className="mt-2 text-pretty text-text-muted">
              위젯 하나를 붙이면 다섯 가지 질문 타입이 그대로 동작하고, 대시보드가 응답을 실시간
              집계로 바꿉니다.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                style={{ '--d': `${i * 70}ms` } as CSSProperties}
                className="reveal group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-md"
              >
                <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-fg transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3">
                  <f.icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-text">{f.title}</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-pretty text-text-muted">
                  {f.body}
                </p>
                {/* hover 시 상단 가장자리로 그어지는 강조 라인 — 카드가 "켜지는" 느낌 */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-accent to-transparent transition-transform duration-300 group-hover:scale-x-100 motion-reduce:transition-none"
                />
                {/* hover 시 우하단에서 번지는 강조 글로우 */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -bottom-8 size-24 rounded-full bg-accent/0 blur-2xl transition-colors duration-300 group-hover:bg-accent/15"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── 임베드 스니펫 ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="임베드 방법">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="reveal">
              <h2 className="text-2xl font-semibold tracking-tight text-balance text-text">
                한 줄이면 떠 있는 피드백 버튼
              </h2>
              <p className="mt-3 max-w-prose text-pretty text-text-muted">
                비-React 사이트는 스크립트 태그 하나로 끝납니다. React 앱이라면{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  &lt;FeedbackWidget /&gt;
                </code>{' '}
                컴포넌트를 추가하세요. 활성 설문이 없으면 버튼은 조용히 숨겨집니다.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-text-muted">
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <MessageSquareText className="size-3.5" aria-hidden />
                  </span>
                  접근성 다이얼로그 · 포커스 트랩 · Esc 닫기
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <Star className="size-3.5" aria-hidden />
                  </span>
                  reduced-motion 존중 · 다크 모드 · 강조색 커스터마이즈
                </li>
              </ul>
              <div className="mt-6">
                <Button asChild variant="secondary">
                  <Link to="/login">
                    임베드 가이드 보기{' '}
                    <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </div>
            <CodeBlock code={snippet} language="html" className="reveal [--d:90ms] shadow-md" />
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="reveal relative overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center shadow-sm sm:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 opacity-90"
              style={{
                background:
                  'radial-gradient(50% 80% at 50% 0%, var(--color-accent-soft) 0%, transparent 70%)',
              }}
            />
            <Badge tone="accent" size="sm">
              DB 0 · 즉시 부팅
            </Badge>
            <h2 className="mx-auto mt-4 max-w-[20ch] text-[clamp(1.65rem,4vw,2.5rem)] font-semibold tracking-tight text-balance text-text">
              DB 없이 지금 바로 실행
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-text-muted">
              PGlite 폴백으로 Postgres·Docker 없이 즉시 부팅됩니다. 데모 설문과 샘플 응답이 함께
              시드되어, 대시보드를 바로 둘러볼 수 있습니다.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/demo">
                  위젯 데모{' '}
                  <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/sitemap">사이트맵</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── 푸터 ── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-text-subtle">
            <Brand compact />
            <span>SurveyDesk</span>
          </div>
          <nav aria-label="푸터" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link to="/demo" className="text-text-muted transition-colors hover:text-text">
              위젯 데모
            </Link>
            <Link to="/support" className="text-text-muted transition-colors hover:text-text">
              문의
            </Link>
            <Link to="/sitemap" className="text-text-muted transition-colors hover:text-text">
              디자인 시스템
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
