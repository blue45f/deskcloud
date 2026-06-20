import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { ErrorState, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getTenant } from '@/services/changelog'
import { installSnippet, reactSnippet, vanillaSnippet } from '@/utils/embed'

const STEPS = [
  {
    n: 1,
    title: '키를 확인하세요',
    body: '아래 스니펫에는 이 워크스페이스의 퍼블리시 키(pk_)가 채워져 있습니다. 브라우저 노출이 안전합니다.',
  },
  {
    n: 2,
    title: '스니펫을 앱에 붙여넣으세요',
    body: 'React 앱이면 컴포넌트를, 그 외 사이트면 스크립트 한 줄을 추가합니다.',
  },
  {
    n: 3,
    title: 'Origin 을 허용하세요',
    body: '위젯이 뜨는 사이트 origin 을 테넌트 설정의 CORS 허용 목록에 추가해야 합니다.',
  },
]

export default function EmbedPage() {
  useDocumentTitle('임베드')

  const {
    data: tenant,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'tenant'],
    queryFn: getTenant,
  })

  const defaultEndpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  const [endpoint, setEndpoint] = useState(defaultEndpoint)
  const [accent, setAccent] = useState('#2f5fe0')

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (isError || !tenant) {
    return (
      <div className="mx-auto max-w-md py-16">
        <ErrorState
          title="워크스페이스 정보를 불러오지 못했습니다"
          description={
            (error as Error)?.message ??
            '퍼블리시 키를 가져오지 못해 스니펫을 채울 수 없습니다. 다시 시도해 주세요.'
          }
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  const pk = tenant.publishableKey
  const cfg = { publishableKey: pk, endpoint, accent }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">임베드</h1>
        <p className="mt-1 max-w-2xl text-pretty text-text-muted">
          ChangelogDesk 위젯을 사이트에 붙이는 방법입니다. 위젯은 의존성이 적고(React 는 peer), 외부
          CSS 프레임워크 없이 스코프 스타일로 동작합니다.
        </p>
      </div>

      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-lg border border-border bg-surface p-5">
            <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-fg">
              {s.n}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-text">{s.title}</h3>
            <p className="mt-1 text-[0.8125rem] text-pretty text-text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>스니펫 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="API endpoint"
              htmlFor="embed-endpoint"
              hint="위젯이 호출할 ChangelogDesk API 베이스 URL"
            >
              <Input
                id="embed-endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="강조색 (선택)" htmlFor="embed-accent">
              <div className="flex items-center gap-2">
                <input
                  id="embed-accent"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-bg"
                  aria-label="강조색 선택"
                />
                <Input
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="font-mono"
                  aria-label="강조색 HEX"
                />
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Tabs defaultValue="react">
            <TabsList>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="vanilla">스크립트 태그</TabsTrigger>
            </TabsList>

            <TabsContent value="react" className="space-y-4 pt-5">
              <div>
                <p className="mb-2 text-sm font-medium text-text">1. 패키지 설치</p>
                <CodeBlock code={installSnippet()} language="bash" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text">2. 컴포넌트 추가</p>
                <CodeBlock code={reactSnippet(cfg)} language="tsx" />
              </div>
              <p className="text-xs text-text-subtle">
                <Badge tone="info" size="sm">
                  팁
                </Badge>{' '}
                위젯은 퍼블리시 키(pk_)만 사용합니다 — 시크릿 키를 브라우저에 넣지 마세요.
              </p>
            </TabsContent>

            <TabsContent value="vanilla" className="space-y-4 pt-5">
              <p className="text-sm text-text-muted">
                비-React 사이트는 IIFE 빌드를 불러오고{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                  ChangelogDesk.init
                </code>{' '}
                한 번만 호출하면 됩니다.
              </p>
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
              <p className="text-xs text-text-subtle">
                <Badge tone="warning" size="sm">
                  참고
                </Badge>{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                  changelog-widget.js
                </code>{' '}
                는 위젯 패키지의 IIFE 빌드 산출물입니다. 셀프호스팅 시 정적 파일로 함께 배포하세요.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-text-muted">
        먼저 동작을 보고 싶다면{' '}
        <Link to="/demo" className="font-medium text-accent-strong hover:text-accent">
          위젯 데모
        </Link>{' '}
        에서 미읽음 배지·패널까지 체험할 수 있습니다.
        <div className="mt-3">
          <Button asChild size="sm" variant="secondary">
            <Link to="/demo">
              위젯 데모 열기 <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
