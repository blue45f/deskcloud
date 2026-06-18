import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DeskGlyph } from '@/components/feature/DeskGlyph'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { DESK_CATALOG, PRODUCT_DESKS, embedSnippet, type DeskEntry } from '@/data/deskCatalog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

function DeskCard({ desk }: { desk: DeskEntry }) {
  const [appId, setAppId] = useState('my-app')
  const inputId = `appid-${desk.id}`
  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <DeskGlyph icon={desk.icon} tone={desk.tone} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text">{desk.name}</h3>
            <Badge tone="success" size="sm" dot>
              Live
            </Badge>
            {desk.isCore ? (
              <Badge tone="accent" size="sm">
                코어
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-[0.8125rem] font-medium text-accent-strong">{desk.tagline}</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-pretty text-text-muted">{desk.what}</p>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {desk.metrics.map((m) => (
          <li key={m}>
            <Badge tone="outline" size="sm">
              {m}
            </Badge>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-text-subtle">
          appId
        </label>
        <input
          id={inputId}
          value={appId}
          onChange={(e) => setAppId(e.target.value.trim() || 'my-app')}
          className="h-7 w-40 rounded-md border border-border bg-bg px-2 font-mono text-xs text-text outline-none focus-visible:border-accent-strong focus-visible:ring-2 focus-visible:ring-accent-strong/30"
          aria-label={`${desk.name} appId`}
        />
      </div>

      <div className="mt-2">
        <CodeBlock code={embedSnippet(desk, appId)} language="html" />
      </div>
    </article>
  )
}

export default function CatalogPage() {
  useDocumentTitle('서비스 카탈로그')
  const core = DESK_CATALOG.find((d) => d.isCore)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="max-w-2xl">
        <Badge tone="accent" size="sm">
          통합 디렉터리
        </Badge>
        <h1 className="mt-3 text-[clamp(1.9rem,5vw,2.8rem)] font-semibold tracking-tight text-balance text-text">
          DeskCloud 서비스 카탈로그
        </h1>
        <p className="mt-4 text-pretty text-text-muted">
          {PRODUCT_DESKS.length}개 제품 Desk + 플랫폼 코어. 모두 같은 계정·빌링을 공유하며, 각
          카드의 스니펫을 그대로 복사해 한 줄로 임베드할 수 있습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/signup">
              키 발급받기 <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/docs">통합 가이드</Link>
          </Button>
        </div>
      </header>

      {core ? (
        <section className="mt-12" aria-label="플랫폼 코어">
          <h2 className="text-xs font-semibold tracking-wide text-text-subtle uppercase">
            플랫폼 코어
          </h2>
          <div className="mt-3">
            <DeskCard desk={core} />
          </div>
        </section>
      ) : null}

      <section className="mt-12" aria-label="제품 Desk">
        <h2 className="text-xs font-semibold tracking-wide text-text-subtle uppercase">
          제품 Desk
        </h2>
        <div className="mt-3 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PRODUCT_DESKS.map((d) => (
            <DeskCard key={d.id} desk={d} />
          ))}
        </div>
      </section>
    </div>
  )
}
