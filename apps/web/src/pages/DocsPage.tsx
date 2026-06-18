import { ArrowRight, BookOpen, KeyRound, Plug, Webhook } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { DeskGlyph } from '@/components/feature/DeskGlyph'
import {
  PRODUCT_DESKS,
  embedEndpoint,
  embedSnippet,
  restSnippet,
} from '@/data/deskCatalog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const NAV = [
  { id: 'concepts', label: '핵심 개념' },
  { id: 'one-line', label: '한 줄 임베드' },
  { id: 'react', label: 'React 통합' },
  { id: 'auth', label: '인증·키' },
  { id: 'endpoints', label: 'Desk별 엔드포인트' },
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
    <section id={id} className="scroll-mt-24 border-t border-border py-10 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold tracking-tight text-text">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

const endpoint = embedEndpoint()

const reactSnippet = `import { SurveyDesk } from '@deskcloud/react'

export function App() {
  return (
    <SurveyDesk.Provider appId="my-app" endpoint="${endpoint}">
      {/* 어떤 Desk든 같은 Provider 패턴 */}
      <SurveyDesk.FeedbackButton />
    </SurveyDesk.Provider>
  )
}`

const vanillaSnippet = `<script src="${endpoint}/<desk>-widget.js" defer></script>
<script>
  <Desk>.init({ appId: 'my-app', endpoint: '${endpoint}' })
</script>`

export default function DocsPage() {
  useDocumentTitle('문서')

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="max-w-2xl">
        <Badge tone="accent" size="sm">
          개발자 문서
        </Badge>
        <h1 className="mt-3 text-[clamp(1.9rem,5vw,2.8rem)] font-semibold tracking-tight text-balance text-text">
          어떤 Desk든 한 줄로 통합하기
        </h1>
        <p className="mt-4 text-pretty text-text-muted">
          DeskCloud 의 모든 서비스는 동일한 SDK/위젯 패턴을 따릅니다. 한 번 익히면 전체 패밀리에
          그대로 적용됩니다.
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
          <Section id="concepts" title="핵심 개념">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: KeyRound,
                  t: 'appId',
                  d: '테넌트 안에서 데이터를 분리하는 네임스페이스. 앱/사이트마다 하나.',
                },
                {
                  icon: Plug,
                  t: 'endpoint',
                  d: '서비스 API 베이스 URL. 모든 Desk 가 같은 호스트를 가리킵니다.',
                },
                {
                  icon: BookOpen,
                  t: '키',
                  d: 'pk_…(공개 임베드)와 sk_…(서버 전용). 가입 시 한 쌍 발급.',
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

          <Section id="one-line" title="한 줄 임베드 (Vanilla)">
            <p className="text-sm text-text-muted">
              비-React 사이트는 스크립트 태그 하나면 충분합니다.{' '}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                &lt;desk&gt;
              </code>
              ,{' '}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                &lt;Desk&gt;
              </code>{' '}
              를 실제 서비스 이름으로 바꾸세요.
            </p>
            <CodeBlock code={vanillaSnippet} language="html" />
            <p className="text-sm text-text-muted">예: SurveyDesk 통합</p>
            <CodeBlock
              code={embedSnippet(
                PRODUCT_DESKS.find((d) => d.id === 'surveydesk') ?? PRODUCT_DESKS[0]!,
                'my-app'
              )}
              language="html"
            />
          </Section>

          <Section id="react" title="React 통합">
            <p className="text-sm text-text-muted">
              React 앱은 Provider + 컴포넌트 패턴을 씁니다. 모든 Desk 가 동일한 형태를 제공합니다.
            </p>
            <CodeBlock code={reactSnippet} language="tsx" />
          </Section>

          <Section id="auth" title="인증·키">
            <ul className="space-y-2 text-sm text-text-muted">
              <li>
                <strong className="text-text">publishable 키(pk_…)</strong> — 프론트엔드에서 사용.
                CORS allowlist 와 함께 검증되어 공개해도 안전합니다.
              </li>
              <li>
                <strong className="text-text">secret 키(sk_…)</strong> — 서버 전용. 빌링·계정 API 는{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  Authorization: Bearer sk_…
                </code>{' '}
                로 호출합니다.
              </li>
            </ul>
            <CodeBlock
              code={restSnippet('/api/usage', 'my-app').replace('pk_…', 'sk_…')}
              language="bash"
            />
            <Button asChild variant="secondary" size="sm">
              <Link to="/signup">
                키 발급받기 <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Section>

          <Section id="endpoints" title="Desk별 엔드포인트">
            <p className="text-sm text-text-muted">
              위젯 스크립트와 SDK 전역 이름은 Desk 마다 다르지만, init() 시그니처는 동일합니다.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-2 text-xs text-text-subtle">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Desk
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      SDK 전역
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      위젯 스크립트
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
                        {d.sdkGlobal}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[0.8125rem] text-text-muted">
                        {d.widgetSrc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
