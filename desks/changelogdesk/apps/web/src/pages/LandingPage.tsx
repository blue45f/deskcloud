import {
  ArrowRight,
  Bell,
  Code2,
  KeyRound,
  Moon,
  PenLine,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useTheme } from '@/app/ThemeContext'
import { Reveal } from '@/components/common/Reveal'
import { WidgetPreview } from '@/components/feature/WidgetPreview'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge, TagBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { shareLink } from '@/lib/share'

function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
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
  )
}

const FEATURES = [
  {
    icon: Bell,
    title: '인앱 What’s new 위젯',
    body: '우측 하단 벨 버튼 + 미읽음 배지. 사용자가 새 소식을 놓치지 않습니다. 마크다운 본문·태그·버전·날짜.',
  },
  {
    icon: KeyRound,
    title: '키 분리 — 안전한 임베드',
    body: '브라우저용 퍼블리시 키(pk_)는 읽기 전용, 서버용 시크릿 키(sk_)는 전체 CRUD. 시크릿은 해시로만 저장.',
  },
  {
    icon: ShieldCheck,
    title: '테넌트별 CORS · 사용량',
    body: '위젯이 뜨는 origin 화이트리스트를 테넌트마다 강제. free 플랜 월간 소프트 한도와 사용량 카운터 내장.',
  },
  {
    icon: PenLine,
    title: '마크다운 에디터 + 미리보기',
    body: '작성/미리보기 토글, 태그 픽커, 버전 필드, 게시 토글. 게시하면 위젯에 즉시 반영됩니다.',
  },
  {
    icon: Zap,
    title: '의존성 0 위젯',
    body: 'React peer 외 의존성 없음. 외부 CSS 프레임워크 없이 스코프 인라인 스타일. 비-React 사이트는 스크립트 한 줄.',
  },
  {
    icon: Code2,
    title: 'SaaS · 셀프호스팅',
    body: 'PGlite 폴백으로 DB 없이 즉시 실행하거나, PostgreSQL 로 운영. 글로벌 ADMIN_TOKEN 으로 단일 테넌트 셀프호스팅도 가능.',
  },
] as const

const ONBOARDING = [
  {
    n: 1,
    title: '셀프서브 가입',
    body: '워크스페이스 이름만 입력하면 pk/sk 를 즉시 발급합니다. 카드 불필요.',
  },
  {
    n: 2,
    title: '위젯 임베드',
    body: '퍼블리시 키로 React 컴포넌트 또는 스크립트 한 줄을 붙입니다.',
  },
  {
    n: 3,
    title: '변경 이력 게시',
    body: '대시보드에서 항목을 작성·게시하면 사용자 위젯에 바로 나타납니다.',
  },
] as const

const STATS = [
  { value: '< 5분', label: '가입부터 임베드까지' },
  { value: '1줄', label: '비-React 사이트 스니펫' },
  { value: '0', label: '위젯 런타임 의존성' },
] as const

export default function LandingPage() {
  useDocumentTitle()

  const embedSnippet = `<script src="https://changelog.example.com/changelog-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    ChangelogDesk.init({ publishableKey: 'pk_live_…', endpoint: 'https://changelog.example.com' })
  })
</script>`

  const onShare = async () => {
    const result = await shareLink({
      title: 'ChangelogDesk',
      text: '사용자에게 새 소식을 알리는 인앱 체인지로그 위젯',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://changelogdesk.app',
    })
    if (result === 'copied') toast.success('링크를 클립보드에 복사했습니다.')
    else if (result === 'unavailable') toast.error('이 브라우저에서는 공유할 수 없습니다.')
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/sitemap">사이트맵</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/demo">데모</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/support">문의</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">콘솔 로그인</Link>
            </Button>
            <MemberAuthControl />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* ── 히어로 ── */}
        <section className="relative overflow-hidden">
          {/* 장식 배경: 워밍 앰버 오로라 블롭 + 점 그리드. 순수 장식이라 aria-hidden. */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
            <div className="cd-aurora absolute -top-24 -left-16 size-[34rem] rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent)] opacity-70 blur-2xl" />
            <div className="cd-aurora-slow absolute -top-10 right-[-8rem] size-[30rem] rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent)] opacity-50 blur-2xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [background-size:26px_26px] opacity-[0.5] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24 lg:pb-20">
            {/* 좌: 카피 + CTA — 진입 스태거 */}
            <div className="max-w-2xl">
              <div className="cd-rise" style={{ animationDelay: '0ms' }}>
                <Badge tone="accent" size="sm">
                  <Sparkles className="size-3.5" /> 외부 온보딩형 멀티테넌트
                </Badge>
              </div>
              <h1
                className="cd-rise mt-4 text-[clamp(2.25rem,6vw,4rem)] leading-[1.04] font-semibold tracking-tight text-balance"
                style={{ animationDelay: '60ms' }}
              >
                사용자에게 새 소식을 알리는{' '}
                <span className="cd-gradient-text">인앱 체인지로그</span>
              </h1>
              <p
                className="cd-rise mt-5 max-w-xl text-lg text-pretty text-text-muted"
                style={{ animationDelay: '120ms' }}
              >
                ChangelogDesk 는 제품의 새 기능·개선·수정을 인앱{' '}
                <strong className="font-semibold text-text">&ldquo;What&rsquo;s new&rdquo;</strong>{' '}
                위젯으로 보여줍니다. 직접 가입해 키를 받고 몇 분 만에 임베드하세요.
              </p>
              <div
                className="cd-rise mt-8 flex flex-col gap-3 sm:flex-row"
                style={{ animationDelay: '180ms' }}
              >
                <Button asChild variant="accent" size="lg" className="group">
                  <Link to="/signup">
                    무료로 시작하기{' '}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link to="/demo">위젯 데모 보기</Link>
                </Button>
                <Button variant="ghost" size="lg" onClick={() => void onShare()}>
                  <Share2 className="size-4" /> 공유
                </Button>
              </div>
              <p
                className="cd-rise mt-5 flex flex-wrap items-center gap-2 text-sm text-text-subtle"
                style={{ animationDelay: '240ms' }}
              >
                미리보기:
                <TagBadge tag="new" />
                <TagBadge tag="improved" />
                <TagBadge tag="fixed" />
                <TagBadge tag="announcement" />
              </p>
            </div>

            {/* 우: 부유 위젯 프리뷰 — 진입 후 부드럽게 떠오름 */}
            <div
              className="cd-rise flex justify-center lg:justify-end"
              style={{ animationDelay: '160ms' }}
            >
              <WidgetPreview />
            </div>
          </div>

          {/* 스탯 스트립 */}
          <div className="border-y border-border bg-surface/60">
            <dl className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-border px-4 sm:px-6">
              {STATS.map((s, i) => (
                <Reveal key={s.label} delay={i * 80} className="px-2 py-6 text-center sm:px-6">
                  <dt className="font-mono text-2xl font-semibold text-text sm:text-3xl">
                    {s.value}
                  </dt>
                  <dd className="mt-1 text-xs text-text-muted sm:text-sm">{s.label}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* ── 온보딩 3단계 ── */}
        <section className="bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <Reveal className="max-w-2xl">
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-balance text-text">
                외부 서비스도 직접 온보딩
              </h2>
              <p className="mt-2 text-pretty text-text-muted">
                형제 앱만이 아니라, 어떤 외부 서비스든 셀프서브로 가입해 자기 키로 위젯을 띄울 수
                있습니다.
              </p>
            </Reveal>
            <ol className="mt-10 grid gap-4 sm:grid-cols-3">
              {ONBOARDING.map((s, i) => (
                <Reveal as="li" key={s.n} delay={i * 110} className="relative">
                  {/* 단계 연결선(데스크탑) — 카드 사이로 흐르는 점선 */}
                  {i < ONBOARDING.length - 1 ? (
                    <span
                      className="absolute top-10 left-[calc(100%+0.25rem)] hidden h-px w-4 bg-gradient-to-r from-border-strong to-transparent sm:block"
                      aria-hidden
                    />
                  ) : null}
                  <div className="group h-full rounded-xl border border-border bg-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-md">
                    <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-semibold text-ink-fg transition-transform duration-200 group-hover:scale-110">
                      {s.n}
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-text">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-pretty text-text-muted">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 기능 그리드 ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <Reveal className="max-w-2xl">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-balance text-text">
              필요한 건 다 있습니다
            </h2>
            <p className="mt-2 text-pretty text-text-muted">
              임베드 위젯부터 멀티테넌트 키 관리·CORS·사용량까지.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 90}>
                <Card className="group h-full transition-all duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-md">
                  <CardContent>
                    <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-fg transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                      <f.icon className="size-[1.2rem]" aria-hidden />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-text">{f.title}</h3>
                    <p className="mt-1.5 text-[0.8125rem] text-pretty text-text-muted">{f.body}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── 임베드 코드 ── */}
        <section className="border-t border-border bg-surface/50">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
            <Reveal>
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-balance text-text">
                한 줄이면 끝나는 임베드
              </h2>
              <p className="mt-2 max-w-md text-pretty text-text-muted">
                React 앱은 컴포넌트를, 그 외 사이트는 스크립트 태그를 추가하면 됩니다. 퍼블리시
                키만으로 동작하므로 브라우저에 노출돼도 안전합니다.
              </p>
              <div className="mt-6">
                <Button asChild variant="accent" className="group">
                  <Link to="/signup">
                    키 발급받기{' '}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <CodeBlock code={embedSnippet} language="html" />
            </Reveal>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="cd-aurora-slow absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent)] opacity-60 blur-2xl" />
          </div>
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 lg:py-28">
            <Reveal>
              <h2 className="mx-auto max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tight text-balance text-text">
                지금 워크스페이스를 만들고 첫 소식을 게시하세요
              </h2>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild variant="accent" size="lg" className="group">
                  <Link to="/signup">
                    무료로 시작하기{' '}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link to="/demo">위젯 데모 보기</Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-text-subtle sm:flex-row sm:px-6">
          <Brand compact />
          <p>SurveyDesk · TermsDesk 자매 프로젝트 · 외부 온보딩형 멀티테넌트 SaaS</p>
          <nav aria-label="푸터" className="flex items-center gap-4">
            <Link to="/support" className="font-medium text-accent-strong hover:text-accent">
              문의
            </Link>
            <Link to="/sitemap" className="font-medium text-accent-strong hover:text-accent">
              디자인 시스템
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
