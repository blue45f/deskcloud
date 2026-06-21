import { ArrowRight, CreditCard, Boxes, KeyRound, Layers, Package, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DeskGlyph } from '@/components/feature/DeskGlyph'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { InstallTabs } from '@/components/ui/install-tabs'
import { DESK_CATALOG, PRODUCT_DESKS, deskMicrositePath, sdkSnippet } from '@/data/deskCatalog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const VALUE = [
  {
    icon: Package,
    title: 'npm 한 번 설치',
    body: 'npm·pnpm·yarn·bun 중 무엇이든. 단일 SDK 하나로 어떤 Desk든 같은 패턴으로 씁니다.',
  },
  {
    icon: KeyRound,
    title: '하나의 계정·키',
    body: '가입 한 번이면 publishable/secret 키 한 쌍으로 전체 패밀리를 인증합니다.',
  },
  {
    icon: CreditCard,
    title: '통합 빌링',
    body: 'Free·Pro·Scale·Enterprise 플랜과 사용량 한도를 한 콘솔에서 관리합니다.',
  },
  {
    icon: Layers,
    title: '멀티테넌트 코어',
    body: '모든 Desk 가 동일한 테넌트·사용량·집행 기반(@desk/platform)을 공유합니다.',
  },
] as const

const STEPS = [
  { n: '01', title: '가입', body: '테넌트를 만들고 키 한 쌍을 받습니다.', to: '/signup' },
  {
    n: '02',
    title: 'SDK 설치',
    body: 'npm i @heejun/deskcloud — 패키지 매니저 무관.',
    to: '/docs',
  },
  {
    n: '03',
    title: '네이티브 렌더',
    body: 'createXClient 로 앱 컴포넌트에 바로 붙입니다.',
    to: '/catalog',
  },
] as const

export default function LandingPage() {
  useDocumentTitle()
  const survey = DESK_CATALOG.find((d) => d.id === 'surveydesk') ?? DESK_CATALOG[1]
  const snippet = survey ? sdkSnippet(survey) : ''

  return (
    <>
      {/* 히어로 */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <div className="max-w-3xl">
          <Badge tone="accent" size="sm">
            SaaS 패밀리 · 멀티테넌트 + 빌링 코어
          </Badge>
          <h1 className="mt-4 text-[clamp(2.2rem,6vw,3.6rem)] leading-[1.05] font-semibold tracking-tight text-balance text-text">
            여러 SaaS를, 하나의 계정과 한 번의 설치로
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-pretty text-text-muted">
            DeskCloud 는 약관·설문·리뷰·알림·검색·실시간·커뮤니티·광고 같은 제품 기능을 독립 Desk 로
            제공하는 패밀리입니다. 모두 같은 멀티테넌트 + 빌링 코어 위에 있어, 단일 SDK{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-base text-text">
              @heejun/deskcloud
            </code>{' '}
            한 번 설치로 어떤 Desk든 앱 안에서 네이티브로 렌더합니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                무료로 시작하기 <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/catalog">서비스 둘러보기</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-text-subtle">
            신용카드 없이 시작 · Free 플랜 영구 무료 · 결제는 TEST/STUB
          </p>
        </div>
      </section>

      {/* 가치 제안 */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-label="핵심 가치">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE.map((v) => (
            <div key={v.title} className="rounded-lg border border-border bg-surface p-5">
              <DeskGlyph icon={v.icon} tone="accent" />
              <h2 className="mt-3.5 text-sm font-semibold text-text">{v.title}</h2>
              <p className="mt-1 text-[0.8125rem] text-pretty text-text-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SDK 설치 */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-label="SDK 설치">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-text">
              어떤 Desk든, 똑같은 SDK
            </h2>
            <p className="mt-3 max-w-prose text-pretty text-text-muted">
              설치 한 번이면 끝. 모든 Desk 가 동일한{' '}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                createXClient({'{ endpoint, publishableKey }'})
              </code>{' '}
              패턴을 따르므로, 한 번 익히면 전체 패밀리에 그대로 적용됩니다.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-text-muted">
              <li className="flex items-center gap-2">
                <Zap className="size-4 text-accent-strong" aria-hidden />
                의존성 0(zero-dep) · 트리셰이커블 · 자체 타입 동봉
              </li>
              <li className="flex items-center gap-2">
                <KeyRound className="size-4 text-accent-strong" aria-hidden />
                publishable 키 + CORS allowlist 로 안전하게 공개
              </li>
            </ul>
            <div className="mt-6 max-w-sm">
              <InstallTabs />
            </div>
            <div className="mt-6">
              <Button asChild variant="secondary">
                <Link to="/docs">
                  통합 가이드 보기 <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <CodeBlock code={snippet} language="ts" />
        </div>
      </section>

      {/* 서비스 미리보기 */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-label="서비스 디렉터리">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-text">
              DeskCloud 패밀리
            </h2>
            <p className="mt-2 text-text-muted">
              {PRODUCT_DESKS.length}개 제품 Desk + 플랫폼 코어. 전부 라이브.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link to="/catalog">
              전체 보기 <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_DESKS.map((d) => (
            <li key={d.id}>
              <Link
                to={deskMicrositePath(d)}
                className="flex h-full items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                <DeskGlyph icon={d.icon} tone={d.tone} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">{d.name}</span>
                  <span className="mt-0.5 block text-[0.8125rem] text-text-muted">{d.tagline}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 3단계 */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-label="시작 단계">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <Link
              key={s.n}
              to={s.to}
              className="group rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-strong"
            >
              <span className="font-mono text-sm font-semibold text-accent-strong">{s.n}</span>
              <h3 className="mt-3 text-base font-semibold text-text">{s.title}</h3>
              <p className="mt-1 text-[0.8125rem] text-text-muted">{s.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-strong">
                바로가기{' '}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-border bg-surface p-8 text-center sm:p-12">
          <DeskGlyph icon={Boxes} tone="accent" size="lg" className="mx-auto" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance text-text">
            지금 가입하고 첫 Desk를 붙여 보세요
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-text-muted">
            Free 플랜으로 모든 Desk 를 체험할 수 있습니다. 트래픽이 늘면 한 콘솔에서 Pro·Scale 로
            업그레이드하세요.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">무료로 시작</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/pricing">요금제 보기</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
