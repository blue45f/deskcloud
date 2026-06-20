import {
  ArrowRight,
  Command,
  Filter,
  Gauge,
  KeyRound,
  Layers,
  Moon,
  Search,
  Share2,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useTheme } from '@/app/ThemeContext'
import { HeroSearchMock } from '@/components/feature/HeroSearchMock'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useReveal } from '@/hooks/useReveal'
import { ShareButton, type ShareResult } from '@/lib/share'
import { vanillaSnippet } from '@/utils/embed'

const FEATURES = [
  {
    icon: Search,
    title: '전문 검색(full-text)',
    body: 'title·body 토큰 검색. Postgres 에선 tsvector(GIN), PGlite 폴백에선 이식성 있는 LIKE/토큰 랭킹. 결과 형태는 동일.',
  },
  {
    icon: Filter,
    title: '패싯 · 필터',
    body: 'category(단일) · tags(AND) 로 좁히고, 응답에 facet 카운트를 동봉합니다. 필터 사이드바를 바로 만드세요.',
  },
  {
    icon: Sparkles,
    title: '랭킹 · 하이라이트',
    body: 'title 매치가 body 매치보다 무겁게. 매치 토큰 주변을 <mark> 로 감싼 스니펫까지 한 번에.',
  },
  {
    icon: Command,
    title: '⌘K 커맨드 팔레트',
    body: '한 줄 임베드로 ⌘K 팔레트·인라인 박스. 디바운스·키보드 내비·접근성 다이얼로그 내장. 외부 CSS 0.',
  },
  {
    icon: KeyRound,
    title: 'pk_/sk_ 키 모델',
    body: '브라우저 검색은 publishable(pk_) + 테넌트별 CORS, 서버 색인/어드민은 secret(sk_, 해시 저장).',
  },
  {
    icon: Gauge,
    title: '멀티테넌트 · 사용량',
    body: '테넌트별 인덱스·문서·사용량(검색/문서)·free 소프트 캡. 셀프 가입 한 번이면 끝.',
  },
] as const

const STATS = [
  { value: '1줄', label: '임베드 — 스크립트 태그 하나' },
  { value: '0', label: '외부 검색엔진(Elastic 불필요)' },
  { value: '~40ms', label: 'PGlite 폴백 콜드 부팅' },
  { value: '∞', label: '테넌트 · 인덱스 · 문서' },
] as const

function Header() {
  const { resolved, toggle } = useTheme()
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/75 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="SearchDesk 홈" className="group inline-flex">
          <Brand className="transition-transform duration-300 group-hover:scale-[1.03]" />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/sitemap">사이트맵</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/demo">⌘K 데모</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/support">문의</Link>
          </Button>
          {/* 테넌트 콘솔(sk_/어드민 토큰) 진입 — 회원 로그인과 별개로 유지. */}
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">콘솔</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/signup">무료로 시작</Link>
          </Button>
          {/* 통합 회원 로그인(Firebase: 이메일/게스트). 콘솔 로그인과 독립. */}
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

/** 검색 결과 공유/링크 복사 결과를 토스트로 안내. */
function onShared(result: ShareResult): void {
  if (result === 'shared') toast.success('공유했습니다')
  else if (result === 'copied') toast.success('링크를 복사했습니다')
  else if (result === 'unsupported') toast.error('이 브라우저에선 공유할 수 없어요')
}

function FeatureCard({ feature, index }: { feature: (typeof FEATURES)[number]; index: number }) {
  const { ref, revealed } = useReveal<HTMLDivElement>()
  const Icon = feature.icon
  return (
    <div
      ref={ref}
      className={`reveal group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-lg ${revealed ? 'is-revealed' : ''}`}
      style={{ '--reveal-delay': `${index * 70}ms` } as React.CSSProperties}
    >
      {/* 호버 시 상단 강조 라인 */}
      <span className="absolute inset-x-0 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-accent-strong to-transparent transition-transform duration-300 group-hover:scale-x-100" />
      <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-accent-soft to-surface-2 text-accent-fg shadow-xs transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-3.5 text-sm font-semibold text-text">{feature.title}</h3>
      <p className="mt-1 text-[0.8125rem] text-pretty text-text-muted">{feature.body}</p>
    </div>
  )
}

export default function LandingPage() {
  useDocumentTitle()

  const endpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    'https://search.example.com'
  const snippet = vanillaSnippet({ publishableKey: 'pk_demo', endpoint })

  // 섹션별 스크롤 리빌 — 멤버 접근(obj.ref) 대신 destructure 로 받아야
  // react-hooks/refs 룰이 ref 를 ref-prop 으로 인식한다.
  const { ref: embedRef, revealed: embedRevealed } = useReveal<HTMLDivElement>()
  const { ref: ctaRef, revealed: ctaRevealed } = useReveal<HTMLDivElement>()
  const { ref: statsRef, revealed: statsRevealed } = useReveal<HTMLDivElement>()

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* ── 히어로 ── */}
        <section className="relative overflow-hidden">
          {/* 오로라 + 점격자 백드롭 */}
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="dot-grid absolute inset-0" />
            <div
              className="aurora-blob -top-32 -left-24 size-[36rem] bg-accent/35"
              style={{ animationDelay: '0s' }}
            />
            <div
              className="aurora-blob -top-20 right-[-10rem] size-[30rem] bg-warning/25"
              style={{ animationDelay: '-7s' }}
            />
            <div
              className="aurora-blob bottom-[-12rem] left-1/3 size-[28rem] bg-info/20"
              style={{ animationDelay: '-14s' }}
            />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20">
            {/* 좌: 카피 */}
            <div className="max-w-2xl">
              <div
                className="animate-rise"
                style={{ '--rise-delay': '0ms' } as React.CSSProperties}
              >
                <Badge tone="accent" size="sm" className="shadow-xs">
                  <Sparkles className="size-3" aria-hidden />
                  Hosted Search + ⌘K · as a Service
                </Badge>
              </div>
              <h1
                className="animate-rise mt-5 text-[clamp(2.3rem,6.2vw,3.85rem)] leading-[1.04] font-bold tracking-tight text-balance text-text"
                style={{ '--rise-delay': '80ms' } as React.CSSProperties}
              >
                검색과 <span className="text-gradient-flow">⌘K</span> 를,
                <br className="hidden sm:block" /> 인프라 없이{' '}
                <span className="text-gradient-flow">한 줄</span>로
              </h1>
              <p
                className="animate-rise mt-5 max-w-xl text-lg text-pretty text-text-muted"
                style={{ '--rise-delay': '160ms' } as React.CSSProperties}
              >
                SearchDesk 는 외부 온보딩형(멀티테넌트) 호스팅 검색 서비스입니다. 문서를 색인하면
                전문 검색·패싯/필터·랭킹·하이라이트가 붙고, ⌘K 커맨드 팔레트를 한 줄로 임베드합니다.
                <span className="text-text"> Elastic 없이 가볍게.</span>
              </p>
              <div
                className="animate-rise mt-8 flex flex-wrap items-center gap-3"
                style={{ '--rise-delay': '240ms' } as React.CSSProperties}
              >
                <Button asChild size="lg" className="group">
                  <Link to="/signup">
                    무료로 시작
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/demo">
                    <Command className="size-4" /> ⌘K 데모 체험
                  </Link>
                </Button>
              </div>
              <p
                className="animate-rise mt-5 flex items-center gap-1.5 text-xs text-text-subtle"
                style={{ '--rise-delay': '320ms' } as React.CSSProperties}
              >
                <Layers className="size-3.5 text-accent-strong" aria-hidden />
                PGlite 폴백으로 DB·Docker 없이 즉시 실행 · 시드된 데모 테넌트(pk_demo)로 바로 검색
              </p>
            </div>

            {/* 우: 살아있는 ⌘K 목업 */}
            <div className="relative">
              <div
                className="aurora-blob -inset-6 -z-10 bg-accent/15"
                style={{ filter: 'blur(40px)' }}
                aria-hidden
              />
              <HeroSearchMock
                className="animate-scale-in"
                // delay 는 인라인 변수로.
              />
              {/* 부유하는 데코 칩 */}
              <span
                className="absolute -top-3 -right-2 hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[0.7rem] font-medium text-text-muted shadow-md sm:inline-flex"
                style={{ animation: 'float-soft 5s ease-in-out infinite' }}
                aria-hidden
              >
                <Zap className="size-3 text-warning" /> 디바운스 · 즉시 결과
              </span>
              <span
                className="absolute -bottom-3 -left-3 hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[0.7rem] font-medium text-text-muted shadow-md sm:inline-flex"
                style={{ animation: 'float-soft 6s ease-in-out infinite', animationDelay: '-2s' }}
                aria-hidden
              >
                <Sparkles className="size-3 text-accent-strong" /> 랭킹 · 하이라이트
              </span>
            </div>
          </div>
        </section>

        {/* ── 신뢰 스탯 밴드 ── */}
        <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6" aria-label="핵심 지표">
          <div
            ref={statsRef}
            className={`reveal grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4 ${statsRevealed ? 'is-revealed' : ''}`}
          >
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="bg-surface px-5 py-5 text-center transition-colors hover:bg-surface-2"
                style={{ '--reveal-delay': `${i * 60}ms` } as React.CSSProperties}
              >
                <div className="text-2xl font-bold tracking-tight text-text sm:text-[1.65rem]">
                  {s.value}
                </div>
                <div className="mt-1 text-[0.72rem] text-pretty text-text-subtle">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 기능 그리드 ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="주요 기능">
          <div className="mx-auto mb-9 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-balance text-text sm:text-3xl">
              검색 UX 를 통째로, 한 곳에서
            </h2>
            <p className="mt-3 text-pretty text-text-muted">
              색인부터 랭킹·하이라이트·⌘K 임베드까지 — 따로 붙일 필요 없이 한 서비스로.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} feature={f} index={i} />
            ))}
          </div>
        </section>

        {/* ── 임베드 스니펫 ── */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-label="임베드 방법">
          <div
            ref={embedRef}
            className={`reveal grid items-center gap-10 lg:grid-cols-2 ${embedRevealed ? 'is-revealed' : ''}`}
          >
            <div>
              <Badge tone="neutral" size="sm">
                <Command className="size-3" aria-hidden /> 1줄 임베드
              </Badge>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-balance text-text">
                한 줄이면 ⌘K 가 열립니다
              </h2>
              <p className="mt-3 max-w-prose text-pretty text-text-muted">
                비-React 사이트는 스크립트 태그 하나로 끝납니다. React 앱이라면{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  &lt;SearchPalette /&gt;
                </code>{' '}
                컴포넌트를 추가하세요. 검색에는 publishable 키(pk_)만 쓰면 됩니다.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-text-muted">
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <Command className="size-3.5" aria-hidden />
                  </span>
                  접근성 다이얼로그 · 포커스 트랩 · ↑/↓ 내비 · Esc 닫기
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <Sparkles className="size-3.5" aria-hidden />
                  </span>
                  reduced-motion 존중 · 다크 모드 · 강조색 커스터마이즈 · 외부 CSS 0
                </li>
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild variant="secondary" className="group">
                  <Link to="/signup">
                    내 키 발급받기
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <ShareButton
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none"
                  title="SearchDesk — 검색과 ⌘K 를 한 줄로"
                  text="Hosted Search + ⌘K as a Service. Elastic 없이 가볍게."
                  copiedLabel={
                    <>
                      <Share2 className="size-4" aria-hidden /> 링크 복사됨
                    </>
                  }
                  onShared={onShared}
                >
                  <Share2 className="size-4" aria-hidden /> 공유
                </ShareButton>
              </div>
            </div>
            <CodeBlock code={snippet} language="html" />
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div
            ref={ctaRef}
            className={`reveal relative overflow-hidden rounded-2xl border border-border-strong/60 bg-surface p-8 text-center shadow-md sm:p-14 ${ctaRevealed ? 'is-revealed' : ''}`}
          >
            {/* CTA 오로라 백드롭 */}
            <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
              <div className="dot-grid absolute inset-0 opacity-60" />
              <div className="aurora-blob -top-16 left-1/4 size-72 bg-accent/40" />
              <div
                className="aurora-blob -bottom-20 right-1/4 size-72 bg-warning/25"
                style={{ animationDelay: '-9s' }}
              />
            </div>
            <Badge tone="accent" size="sm" className="shadow-xs">
              <Zap className="size-3" aria-hidden /> 셀프 가입 · 즉시 시작
            </Badge>
            <h2 className="mx-auto mt-4 max-w-2xl text-2xl font-bold tracking-tight text-balance text-text sm:text-[2rem]">
              지금 가입하고, 문서를 색인하세요
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-text-muted">
              셀프 가입으로 pk_/sk_ 키를 받고, 대시보드에서 문서를 추가한 뒤 라이브 검색 테스터로
              랭킹과 패싯을 바로 확인하세요. free 플랜은 소프트 캡 안에서 무료입니다.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="group">
                <Link to="/signup">
                  무료로 시작
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/demo">⌘K 데모 체험</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── 푸터 ── */}
      <footer className="relative border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-text-subtle">
            <Brand compact />
            <span>SearchDesk</span>
            <span className="text-border-strong">·</span>
            <span className="text-text-subtle">Hosted Search + ⌘K</span>
          </div>
          <nav aria-label="푸터" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link to="/demo" className="text-text-muted transition-colors hover:text-accent-strong">
              ⌘K 데모
            </Link>
            <Link
              to="/status"
              className="text-text-muted transition-colors hover:text-accent-strong"
            >
              현황
            </Link>
            <Link
              to="/sitemap"
              className="text-text-muted transition-colors hover:text-accent-strong"
            >
              디자인 시스템
            </Link>
            <Link
              to="/support"
              className="text-text-muted transition-colors hover:text-accent-strong"
            >
              문의
            </Link>
            <Link
              to="/signup"
              className="text-text-muted transition-colors hover:text-accent-strong"
            >
              가입
            </Link>
            <Link
              to="/login"
              className="text-text-muted transition-colors hover:text-accent-strong"
            >
              로그인
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
