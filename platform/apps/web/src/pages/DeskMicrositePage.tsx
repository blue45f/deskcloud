import { ArrowLeft, ArrowRight, CheckCircle2, Copy, KeyRound, Package } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { DeskGlyph } from '@/components/feature/DeskGlyph'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { InstallTabs } from '@/components/ui/install-tabs'
import {
  PRODUCT_DESKS,
  SDK_PACKAGE,
  apiEndpoint,
  deskMicrositePath,
  restSnippet,
  sdkSnippet,
} from '@/data/deskCatalog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const endpoint = apiEndpoint()

export default function DeskMicrositePage() {
  const { deskId } = useParams()
  const desk = PRODUCT_DESKS.find((d) => d.id === deskId)

  useDocumentTitle(desk ? `${desk.name} 마이크로사이트` : 'Desk를 찾을 수 없음')

  if (!desk) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4">
        <div className="max-w-md text-center">
          <p className="font-mono text-5xl font-semibold text-accent-strong">404</p>
          <h1 className="mt-3 text-lg font-semibold text-balance text-text">
            Desk를 찾을 수 없습니다
          </h1>
          <p className="mt-1 text-sm text-pretty text-text-muted">
            카탈로그에 등록된 제품 Desk만 마이크로사이트를 제공합니다.
          </p>
          <div className="mt-6 flex flex-col-reverse items-center justify-center gap-2 sm:flex-row">
            <Button asChild variant="secondary">
              <Link to="/catalog">서비스 카탈로그</Link>
            </Button>
            <Button asChild>
              <Link to="/">홈으로</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const siblingDesks = PRODUCT_DESKS.filter((d) => d.id !== desk.id).slice(0, 4)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm">
          <Link to="/catalog">
            <ArrowLeft className="size-4" />
            카탈로그
          </Link>
        </Button>
      </div>

      <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" size="sm" dot>
              Live
            </Badge>
            <Badge tone={desk.tone} size="sm">
              {desk.tagline}
            </Badge>
          </div>
          <div className="mt-5 flex items-start gap-4">
            <DeskGlyph icon={desk.icon} tone={desk.tone} size="lg" className="shrink-0" />
            <div className="min-w-0">
              <h1 className="text-[clamp(2.2rem,7vw,4.5rem)] leading-[0.95] font-semibold tracking-tight text-balance text-text">
                {desk.name}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-pretty text-text-muted">
                {desk.what}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/signup">
                키 발급받기 <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/docs">통합 가이드</Link>
            </Button>
          </div>
        </div>

        <aside className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold tracking-wide text-text-subtle uppercase">
            Integration
          </p>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
              <div>
                <dt className="font-medium text-text">SDK</dt>
                <dd className="mt-0.5 font-mono text-[0.8125rem] text-text-muted">{SDK_PACKAGE}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
              <div>
                <dt className="font-medium text-text">Auth</dt>
                <dd className="mt-0.5 text-[0.8125rem] text-text-muted">
                  publishable key + tenant CORS
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <div>
                <dt className="font-medium text-text">Endpoint</dt>
                <dd className="mt-0.5 break-all font-mono text-[0.8125rem] text-text-muted">
                  {endpoint}
                </dd>
              </div>
            </div>
          </dl>
        </aside>
      </header>

      <section className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="핵심 지표">
        {desk.metrics.map((metric) => (
          <div key={metric} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-semibold tracking-wide text-text-subtle uppercase">Metric</p>
            <p className="mt-2 text-sm font-semibold text-text">{metric}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-text">SDK quickstart</h2>
              <p className="mt-1 text-sm text-text-muted">
                같은 패키지, 같은 클라이언트 패턴으로 앱 안에 붙입니다.
              </p>
            </div>
            <Badge tone="outline" size="sm">
              {desk.sdkFactory}
            </Badge>
          </div>
          <div className="mt-4">
            <InstallTabs />
          </div>
          <div className="mt-5">
            <CodeBlock code={sdkSnippet(desk)} language="ts" />
          </div>
        </div>

        <aside className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight text-text">API shape</h2>
          <p className="mt-1 text-sm text-text-muted">
            SDK 없이 호출할 때도 동일한 endpoint와 publishable key를 씁니다.
          </p>
          <div className="mt-4">
            <CodeBlock code={restSnippet('/api/tenants')} language="bash" />
          </div>
        </aside>
      </section>

      <section className="mt-12" aria-label="다른 Desk">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-text">다른 Desk</h2>
            <p className="mt-1 text-sm text-text-muted">
              같은 계정과 빌링으로 함께 쓸 수 있습니다.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link to="/catalog">
              전체 보기 <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {siblingDesks.map((d) => (
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

      <section className="mt-12 rounded-xl border border-border bg-surface p-6 text-center">
        <Copy className="mx-auto size-5 text-accent-strong" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-text">
          {desk.name}를 앱에 붙일 준비
        </h2>
        <p className="mx-auto mt-1 max-w-2xl text-sm text-pretty text-text-muted">
          키를 발급받으면 이 페이지의 SDK 패턴 그대로 운영 앱에 연결할 수 있습니다.
        </p>
        <div className="mt-5 flex flex-col-reverse items-center justify-center gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link to="/docs">문서 보기</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">
              시작하기 <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
