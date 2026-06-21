import {
  ArrowRight,
  BookOpen,
  Database,
  KeyRound,
  Package,
  Plug,
  ShieldCheck,
  Webhook,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { DeskGlyph } from '@/components/feature/DeskGlyph'
import { Badge, PlanBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { InstallTabs } from '@/components/ui/install-tabs'
import {
  PRODUCT_DESKS,
  SDK_PACKAGE,
  SDK_SERVER_IMPORT,
  USAGE_METRIC_LABEL,
  adminFactory,
  apiEndpoint,
  deskDetails,
  deskMicrositePath,
  deskOperations,
  sdkSnippet,
} from '@/data/deskCatalog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const NAV = [
  { id: 'install', label: '설치' },
  { id: 'concepts', label: '핵심 개념' },
  { id: 'quickstart', label: '빠른 시작' },
  { id: 'tutorials', label: '튜토리얼' },
  { id: 'react', label: 'React 통합' },
  { id: 'auth', label: '인증·키' },
  { id: 'api-reference', label: 'API Reference' },
  { id: 'clients', label: 'Desk별 클라이언트' },
  { id: 'operations', label: '운영 콘솔' },
  { id: 'production-checklist', label: '운영 체크리스트' },
  { id: 'service-reference', label: '서비스별 설명' },
  { id: 'webhooks', label: '웹훅' },
] as const

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-border py-10 first:border-t-0 first:pt-0"
    >
      <h2 className="text-xl font-semibold tracking-tight text-text">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

const endpoint = apiEndpoint()

const survey = PRODUCT_DESKS.find((d) => d.id === 'surveydesk') ?? PRODUCT_DESKS[0]!

const reactSnippet = `import { useEffect, useState } from 'react'
import { createReviewClient, type PublicReviews } from '${SDK_PACKAGE}'

const reviews = createReviewClient({
  endpoint: '${endpoint}',
  publishableKey: 'pk_…',
})

export function ProductReviews({ subjectId }: { subjectId: string }) {
  const [data, setData] = useState<PublicReviews | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    reviews
      .list({ subjectId, limit: 20, signal: ctrl.signal })
      .then(setData)
      .catch(() => setData(null))
    return () => ctrl.abort()
  }, [subjectId])

  // 앱의 디자인 시스템으로 직접 렌더 — 외부 위젯/iframe 0.
  return <YourStars value={data?.aggregate.avgRating ?? 0} count={data?.aggregate.count ?? 0} />
}`

const serverSnippet = `import { createAdAdminClient } from '${SDK_SERVER_IMPORT}'

// 서버 런타임(Node·엣지 함수·API 라우트)에서만 — sk_ 키는 절대 브라우저로 보내지 않습니다.
const admin = createAdAdminClient({
  endpoint: '${endpoint}',
  secretKey: process.env.DESK_SECRET_KEY!, // 'sk_…'
})`

const workspaceManifestSnippet = `# DeskCloud control-plane에서 흡수된 workspace Desk 확인
curl '${endpoint}/api/workspace-desks'
curl '${endpoint}/api/workspace-desks/seo-gateway'
curl '${endpoint}/api/workspace-desks/remote-devtools'`

const tenantQuickstartSnippet = `# 1) 가입회사 테넌트 생성 — secretKey는 응답에서 한 번만 표시됩니다.
curl -X POST '${endpoint}/api/tenants' \\
  -H 'content-type: application/json' \\
  -d '{"name":"Acme","corsOrigins":["https://app.acme.com"]}'

# 2) 콘솔 로그인/서버 호출 — sk_ 키를 Bearer로 전달합니다.
curl '${endpoint}/api/tenant' \\
  -H 'authorization: Bearer sk_…'

# 3) 운영 사용량 확인
curl '${endpoint}/api/usage?period=current' \\
  -H 'authorization: Bearer sk_…'`

const API_REFERENCE = [
  {
    method: 'GET',
    path: '/api/billing/plans',
    auth: 'public',
    purpose: 'Free/Pro/Scale/Enterprise 가격과 월간 사용량 한도 조회',
  },
  {
    method: 'POST',
    path: '/api/tenants',
    auth: 'public',
    purpose: '가입회사 테넌트 생성, publishableKey와 1회용 secretKey 발급',
  },
  {
    method: 'GET',
    path: '/api/tenant',
    auth: 'Bearer sk_',
    purpose: '현재 테넌트와 서비스 도메인 allowlist 조회',
  },
  {
    method: 'PUT',
    path: '/api/tenant',
    auth: 'Bearer sk_',
    purpose: '회사명과 서비스 도메인 origin allowlist 수정',
  },
  {
    method: 'POST',
    path: '/api/tenant/rotate-keys',
    auth: 'Bearer sk_',
    purpose: 'secretKey 회전, 새 키 1회 반환',
  },
  {
    method: 'GET',
    path: '/api/usage',
    auth: 'Bearer sk_',
    purpose: '월간 API 호출·이벤트·저장량·좌석 사용량 조회',
  },
  {
    method: 'GET',
    path: '/api/workspace-desks',
    auth: 'public',
    purpose: 'AIDigestDesk, SEOGatewayDesk, RemoteDevTools 통합 manifest 조회',
  },
  {
    method: 'GET',
    path: '/api/workspace-desks/:id',
    auth: 'public',
    purpose: '단일 workspace Desk의 source, gateway, control/data plane 조회',
  },
  {
    method: 'POST',
    path: '/api/v1/apps/:appId/visits/ping',
    auth: 'public',
    purpose: '서비스 앱별 방문 이벤트 집계',
  },
  {
    method: 'GET',
    path: '/api/v1/apps/:appId/inquiries/admin',
    auth: 'X-Admin-Token',
    purpose: '문의 운영 보드 목록 조회, status/originHost 필터',
  },
] as const

const TUTORIALS = [
  {
    title: '가입회사와 서비스 도메인 등록',
    summary: '테넌트 생성, pk_/sk_ 키 발급, origin allowlist 등록까지 콘솔 운영의 첫 경로입니다.',
    steps: ['POST /api/tenants', '서비스 origin 등록', '대시보드에서 키/사용량 확인'],
    href: '/signup',
  },
  {
    title: '첫 Desk SDK 붙이기',
    summary: '카탈로그에서 Desk를 고르고 createXClient 패턴으로 앱 컴포넌트에 직접 렌더합니다.',
    steps: ['pnpm add @heejun/deskcloud', 'createXClient 생성', 'pk_ 키와 endpoint 주입'],
    href: '/catalog',
  },
  {
    title: 'Workspace Desk 운영 검증',
    summary:
      'SEOGatewayDesk와 RemoteDevTools가 별도 제품이 아니라 통합 manifest에 묶였는지 확인합니다.',
    steps: ['GET /api/workspace-desks', '콘솔 parity 확인', 'gateway path와 adminPath 대조'],
    href: '/dashboard?desk=seo-gateway',
  },
] as const

const PRODUCTION_CHECKLIST = [
  'VITE_API_BASE_URL 또는 동일 출처 /api 프록시가 운영 API로 연결되어 있다.',
  '서비스 도메인 origin allowlist에 실제 운영 origin만 등록되어 있다.',
  'sk_ secret key는 서버 환경변수에만 저장하고 브라우저 번들에 포함하지 않는다.',
  '/api/workspace-desks가 seo-gateway, remote-devtools를 workspace_integrated로 반환한다.',
  '대시보드 Workspace Desk 패널의 API manifest parity가 일치 상태다.',
  'billing/usage/tenant API는 Bearer sk_ 인증 실패 시 401/403으로 실패한다.',
  'EC2 Caddy gateway의 /platform/health와 Vercel /api 프록시가 모두 정상이다.',
] as const

export default function DocsPage() {
  useDocumentTitle('문서')

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="max-w-2xl">
        <Badge tone="accent" size="sm">
          개발자 문서
        </Badge>
        <h1 className="mt-3 text-[clamp(1.9rem,5vw,2.8rem)] font-semibold tracking-tight text-balance text-text">
          한 번 설치, 모든 Desk
        </h1>
        <p className="mt-4 text-pretty text-text-muted">
          DeskCloud 의 모든 서비스는 단일 npm 패키지{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
            {SDK_PACKAGE}
          </code>{' '}
          로 통합됩니다. 한 번 설치하면 동일한 <code className="font-mono">createXClient</code>{' '}
          패턴으로 전체 패밀리를 앱 안에서 네이티브로 렌더합니다.
        </p>
      </header>

      <div className="mt-10 gap-10 lg:grid lg:grid-cols-[180px_1fr]">
        <nav aria-label="문서 목차" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5 text-sm">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="block rounded-md px-3 py-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <Section id="install" title="설치">
            <p className="text-sm text-text-muted">
              선호하는 패키지 매니저로 SDK 를 설치하세요. 의존성 0(zero-dep)·트리셰이커블·자체
              타입이라 별도 <code className="font-mono">@types</code> 가 필요 없습니다.
            </p>
            <InstallTabs />
            <p className="flex items-start gap-2 text-sm text-text-muted">
              <Package className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
              <span>
                브라우저용 공개 클라이언트(<code className="font-mono">pk_</code>)는{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  {SDK_PACKAGE}
                </code>{' '}
                에서, 서버 전용 어드민 클라이언트(<code className="font-mono">sk_</code>)는{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  {SDK_SERVER_IMPORT}
                </code>{' '}
                에서 가져옵니다. RealtimeDesk·ChatDesk 의 실시간 연결만{' '}
                <code className="font-mono">socket.io-client</code> 를 선택적 peer 로 씁니다.
              </span>
            </p>
          </Section>

          <Section id="concepts" title="핵심 개념">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Plug,
                  t: 'endpoint',
                  d: 'Desk API 의 베이스 URL. createXClient 에 넘기는 첫 옵션입니다.',
                },
                {
                  icon: KeyRound,
                  t: 'publishableKey',
                  d: 'pk_…(공개 임베드). CORS allowlist 와 함께 검증되어 브라우저에 노출해도 안전.',
                },
                {
                  icon: BookOpen,
                  t: 'secretKey',
                  d: 'sk_…(서버 전용). 어드민/빌링 API 는 /server 클라이언트로만 호출합니다.',
                },
              ].map((c) => (
                <div key={c.t} className="rounded-lg border border-border bg-surface p-4">
                  <DeskGlyph icon={c.icon} tone="accent" size="sm" />
                  <h3 className="mt-2.5 font-mono text-sm font-semibold text-text">{c.t}</h3>
                  <p className="mt-1 text-[0.8125rem] text-text-muted">{c.d}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="quickstart" title="빠른 시작">
            <p className="text-sm text-text-muted">
              설치 후 Desk 의 <code className="font-mono">createXClient</code> 를 import 해서
              endpoint 와 publishable 키로 클라이언트를 만들면 끝입니다. 예: SurveyDesk.
            </p>
            <CodeBlock code={sdkSnippet(survey)} language="ts" />
            <p className="text-sm text-text-muted">
              모든 Desk 가 같은 형태입니다. 각 서비스의 스니펫은{' '}
              <Link to="/catalog" className="font-medium text-accent-strong hover:underline">
                카탈로그
              </Link>{' '}
              에서 그대로 복사하세요.
            </p>
          </Section>

          <Section id="tutorials" title="튜토리얼">
            <p className="text-sm leading-6 text-text-muted">
              DeskCloud 문서는 Stripe식 API reference, Vercel식 운영 체크리스트, Supabase식
              quickstart/tutorial 분리를 기준으로 구성합니다. 처음 붙이는 팀은 아래 순서대로
              진행하면 콘솔, SDK, workspace Desk까지 한 흐름으로 검증할 수 있습니다.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {TUTORIALS.map((tutorial, index) => (
                <article
                  key={tutorial.title}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <p className="font-mono text-[0.6875rem] text-accent-strong">
                    TUTORIAL {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-2 text-sm font-semibold text-text">{tutorial.title}</h3>
                  <p className="mt-1 text-[0.8125rem] leading-5 text-text-muted">
                    {tutorial.summary}
                  </p>
                  <ol className="mt-3 space-y-1.5">
                    {tutorial.steps.map((step, stepIndex) => (
                      <li key={step} className="flex gap-2 text-[0.8125rem] text-text-muted">
                        <span className="font-mono text-accent-strong">{stepIndex + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <Button asChild variant="secondary" size="sm" className="mt-4">
                    <Link to={tutorial.href}>열기</Link>
                  </Button>
                </article>
              ))}
            </div>
            <CodeBlock code={tenantQuickstartSnippet} language="bash" />
          </Section>

          <Section id="react" title="React 통합">
            <p className="text-sm text-text-muted">
              SDK 는 프레임워크에 독립적입니다. React 에서는 클라이언트를 모듈 스코프에 한 번
              만들고, 데이터는 <code className="font-mono">useEffect</code> 로 불러와{' '}
              <strong className="text-text">앱의 컴포넌트로 직접 렌더</strong>합니다. 외부 위젯
              스크립트나 iframe 이 없습니다.
            </p>
            <CodeBlock code={reactSnippet} language="tsx" />
          </Section>

          <Section id="auth" title="인증·키">
            <ul className="space-y-2 text-sm text-text-muted">
              <li>
                <strong className="text-text">publishable 키(pk_…)</strong> — 프론트엔드에서 사용.
                CORS allowlist 와 함께 검증되어 공개해도 안전합니다.{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  {SDK_PACKAGE}
                </code>{' '}
                의 <code className="font-mono">createXClient</code> 가 자동으로 첨부합니다.
              </li>
              <li>
                <strong className="text-text">secret 키(sk_…)</strong> — 서버 전용. 빌링·어드민 API
                는{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  {SDK_SERVER_IMPORT}
                </code>{' '}
                의 <code className="font-mono">createXAdminClient</code> 로 호출합니다. 브라우저
                번들에 절대 포함하지 마세요.
              </li>
            </ul>
            <CodeBlock code={serverSnippet} language="ts" />
            <Button asChild variant="secondary" size="sm">
              <Link to="/signup">
                키 발급받기 <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Section>

          <Section id="api-reference" title="API Reference">
            <p className="text-sm leading-6 text-text-muted">
              공개 API는 표준 HTTP verb, JSON 응답, 명확한 인증 경계를 따릅니다. 공개 조회는 키 없이
              호출할 수 있고, 테넌트·빌링·사용량·운영 작업은 Bearer secret key 또는 X-Admin-Token을
              요구합니다.
            </p>
            <div className="grid gap-2 md:hidden">
              {API_REFERENCE.map((row) => (
                <article
                  key={`${row.method} ${row.path}`}
                  className="rounded-lg border border-border bg-surface p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={row.method === 'GET' ? 'info' : 'accent'} size="sm">
                      {row.method}
                    </Badge>
                    <span className="font-mono text-[0.75rem] text-text-subtle">{row.auth}</span>
                  </div>
                  <p className="mt-2 break-words font-mono text-[0.8125rem] text-text">
                    {row.path}
                  </p>
                  <p className="mt-1 text-[0.8125rem] leading-5 text-text-muted">{row.purpose}</p>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-2 text-xs text-text-subtle">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Method
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Path
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Auth
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      용도
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {API_REFERENCE.map((row) => (
                    <tr
                      key={`${row.method} ${row.path}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <Badge tone={row.method === 'GET' ? 'info' : 'accent'} size="sm">
                          {row.method}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[0.8125rem] text-text">
                        {row.path}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[0.8125rem] text-text-muted">
                        {row.auth}
                      </td>
                      <td className="px-4 py-2.5 text-[0.8125rem] leading-5 text-text-muted">
                        {row.purpose}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CodeBlock code={workspaceManifestSnippet} language="bash" />
          </Section>

          <Section id="clients" title="Desk별 클라이언트">
            <p className="text-sm text-text-muted">
              네이티브 Desk의 브라우저(pk_)와 서버(sk_) 팩토리는 Desk 마다 이름만 다르고 시그니처는
              동일합니다. 워크스페이스 Desk는 자체 SDK/런타임을 보존하되 같은 모노레포와 운영
              콘솔에서 관리합니다.
            </p>
            <div className="grid gap-2 md:hidden">
              {PRODUCT_DESKS.map((d) => {
                const clientValue = d.sdkFactory
                  ? `${d.sdkFactory}()`
                  : d.integrationPackage
                    ? d.integrationPackage
                    : '—'
                const adminValue = d.sdkFactory
                  ? `${adminFactory(d.sdkFactory)}()`
                  : d.integrationMode === 'workspace'
                    ? 'workspace console'
                    : d.integrationMode === 'linked'
                      ? 'linked console'
                      : '—'

                return (
                  <article key={d.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center gap-2 font-medium text-text">
                      <DeskGlyph icon={d.icon} tone={d.tone} size="sm" />
                      {d.name}
                    </div>
                    <dl className="mt-3 grid gap-2 text-[0.8125rem]">
                      <div>
                        <dt className="text-text-subtle">클라이언트 (pk_)</dt>
                        <dd className="mt-0.5 break-words font-mono text-text-muted">
                          {clientValue}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-text-subtle">어드민 (sk_, /server)</dt>
                        <dd className="mt-0.5 break-words font-mono text-text-muted">
                          {adminValue}
                        </dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-2 text-xs text-text-subtle">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Desk
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      클라이언트 (pk_)
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      어드민 (sk_, /server)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PRODUCT_DESKS.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <th scope="row" className="px-4 py-2.5 font-medium text-text">
                        <span className="inline-flex items-center gap-2">
                          <DeskGlyph icon={d.icon} tone={d.tone} size="sm" />
                          {d.name}
                        </span>
                      </th>
                      <td className="px-4 py-2.5 font-mono text-[0.8125rem] text-text-muted">
                        {d.sdkFactory
                          ? `${d.sdkFactory}()`
                          : d.integrationPackage
                            ? d.integrationPackage
                            : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[0.8125rem] text-text-muted">
                        {d.sdkFactory
                          ? `${adminFactory(d.sdkFactory)}()`
                          : d.integrationMode === 'workspace'
                            ? 'workspace console'
                            : d.integrationMode === 'linked'
                              ? 'linked console'
                              : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="operations" title="운영 콘솔과 서비스 도메인 격리">
            <p className="text-sm leading-6 text-text-muted">
              DeskCloud 운영 콘솔은 가입회사 테넌트를 중심으로 동작합니다. 회사 하나가 여러 서비스
              도메인을 운영하더라도 플랜, 키, 사용량, 결제는 하나로 묶고 브라우저 SDK 접근은
              <code className="mx-1 rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                tenant.corsOrigins
              </code>
              allowlist로 제한합니다.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Tenant boundary',
                  body: '가입회사 단위의 계정, 플랜, 사용량, publishable key, secret key 회전 정책입니다.',
                },
                {
                  icon: Plug,
                  title: 'Service origins',
                  body: '서비스 도메인 origin을 등록해 pk_ 키가 호출 가능한 브라우저 범위를 제한합니다.',
                },
                {
                  icon: Database,
                  title: 'Desk data scopes',
                  body: '각 Desk는 slug, namespace, index, board, bucket 같은 도메인별 스코프로 데이터를 나눕니다.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-surface p-4">
                  <DeskGlyph icon={item.icon} tone="accent" size="sm" />
                  <h3 className="mt-3 text-sm font-semibold text-text">{item.title}</h3>
                  <p className="mt-1 text-[0.8125rem] leading-5 text-text-muted">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-dashed border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-text">
                SEOGatewayDesk · RemoteDevTools 같은 개발자 도구형 Desk
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-muted">
                소스와 운영 메타데이터를 deskcloud workspace 안에 두고, 벤더 자산이 큰 런타임은
                명시된 gateway path, primary metric, billing driver 기준으로 같은 콘솔에서
                관리합니다.
              </p>
            </div>
          </Section>

          <Section id="production-checklist" title="운영 체크리스트">
            <p className="text-sm leading-6 text-text-muted">
              배포 전에는 문서와 콘솔이 같은 운영 사실을 가리켜야 합니다. 아래 항목이 모두 통과해야
              DeskCloud control-plane으로 통합 운영된다고 볼 수 있습니다.
            </p>
            <ul className="grid gap-2 md:grid-cols-2">
              {PRODUCTION_CHECKLIST.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-sm text-text-muted"
                >
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="service-reference" title="서비스별 상세 설명">
            <p className="text-sm leading-6 text-text-muted">
              각 Desk는 운영 데이터, 격리 기준, 과금 메트릭이 다릅니다. 네이티브 Desk는 단일 SDK
              패턴을 공유하고, 워크스페이스 Desk는 자체 런타임/SDK 경계를 보존한 채 같은 테넌트와
              서비스 도메인 운영 모델에 묶습니다. 아래 레퍼런스는 콘솔·마이크로사이트와 같은
              카탈로그 데이터를 사용합니다.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {PRODUCT_DESKS.map((desk) => {
                const operations = deskOperations(desk)
                const detail = deskDetails(desk)

                return (
                  <article key={desk.id} className="rounded-lg border border-border bg-surface p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <DeskGlyph icon={desk.icon} tone={desk.tone} size="sm" />
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-text">{desk.name}</h3>
                          <p className="mt-0.5 text-[0.8125rem] text-accent-strong">
                            {desk.tagline}
                          </p>
                        </div>
                      </div>
                      <PlanBadge plan={operations.recommendedPlan} size="sm" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text-muted">{detail.summary}</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-md bg-surface-2 p-3">
                        <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                          SDK
                        </p>
                        <p className="mt-1 font-mono text-[0.8125rem] text-text">
                          {desk.integrationPackage ?? SDK_PACKAGE}
                        </p>
                      </div>
                      <div className="rounded-md bg-surface-2 p-3">
                        <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                          Gateway
                        </p>
                        <p className="mt-1 font-mono text-[0.8125rem] text-text">
                          {operations.gatewayPath}
                        </p>
                      </div>
                      <div className="rounded-md bg-surface-2 p-3">
                        <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                          과금
                        </p>
                        <p className="mt-1 text-[0.8125rem] font-semibold text-text">
                          {USAGE_METRIC_LABEL[operations.primaryMetric]}
                        </p>
                      </div>
                      <div className="rounded-md bg-surface-2 p-3">
                        <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                          데이터
                        </p>
                        <p className="mt-1 text-[0.8125rem] font-semibold text-text">
                          {detail.dataModel.length} objects
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-semibold tracking-wide text-text-subtle uppercase">
                        도메인 격리
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-5 text-text-muted">
                        {detail.domainIsolation}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild variant="secondary" size="sm">
                        <Link to={deskMicrositePath(desk)}>마이크로사이트</Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={operations.adminPath}>콘솔에서 관리</Link>
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </Section>

          <Section id="webhooks" title="웹훅">
            <p className="flex items-start gap-2 text-sm text-text-muted">
              <Webhook className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
              <span>
                Pro 이상 플랜은 이벤트 웹훅을 받을 수 있습니다. 빌링 웹훅은 제공자별 경로(
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  POST /api/billing/webhook/:provider
                </code>
                )로 들어오며 서명 검증을 거칩니다. 모든 결제 어댑터는 TEST/STUB 모드입니다.
              </span>
            </p>
          </Section>

          <div className="mt-10 rounded-xl border border-border bg-surface p-6 text-center">
            <h2 className="text-base font-semibold text-text">준비되셨나요?</h2>
            <p className="mt-1 text-sm text-text-muted">
              가입하고 키를 받은 뒤, 카탈로그에서 스니펫을 복사하세요.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/signup">무료로 시작</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/catalog">카탈로그</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
