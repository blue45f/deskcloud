import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCredKey } from '@/hooks/useCredKey'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTenant } from '@/services/moderation'
import {
  installSdkSnippet,
  installWidgetSnippet,
  reactBadgeSnippet,
  reactReportSnippet,
  serverSnippet,
  vanillaSnippet,
} from '@/utils/embed'

const STEPS = [
  {
    n: 1,
    title: '허용 Origin 을 설정하세요',
    body: '설정에서 위젯이 호출할 사이트의 origin 을 추가해야 브라우저(pk) 호출이 통과합니다.',
  },
  {
    n: 2,
    title: '브라우저 위젯을 붙이세요',
    body: 'publishable 키로 신고 버튼·작성 중 사전검사를 추가합니다(차단 강제는 안 함, UX 힌트).',
  },
  {
    n: 3,
    title: '서버에서 게이트하세요',
    body: 'secret 키로 게시 전에 moderate 를 호출해 차단을 결정합니다. secret 키는 서버 전용.',
  },
]

export default function EmbedPage() {
  useDocumentTitle('임베드')
  const credKey = useCredKey()
  const tenantQ = useTenant(credKey)

  const defaultEndpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    window.location.origin
  const [endpoint, setEndpoint] = useState(defaultEndpoint)
  const [accent, setAccent] = useState('#c0362c')

  const pk = tenantQ.data?.publishableKey ?? 'pk_...'
  const cfg = { publishableKey: pk, endpoint, accent }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">임베드</h1>
        <p className="mt-1 max-w-2xl text-pretty text-text-muted">
          위젯과 서버 SDK 를 형제 앱에 붙이는 방법입니다. 스니펫에는 이 테넌트의 publishable 키가
          채워집니다. secret 키는 가입/회전 시에만 노출되므로 여기엔 표시하지 않습니다.
        </p>
      </div>

      {/* 단계 */}
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-lg border border-border bg-surface p-5">
            <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong">
              {s.n}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-text">{s.title}</h3>
            <p className="mt-1 text-[0.8125rem] text-pretty text-text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      {/* 키 + 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>스니펫 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tenantQ.isLoading ? (
            <Skeleton className="h-9 w-full max-w-md" />
          ) : tenantQ.isError ? (
            <EmptyState
              title="테넌트 정보를 불러오지 못했습니다"
              description={
                tenantQ.error instanceof Error ? tenantQ.error.message : '다시 시도해 주세요.'
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Publishable 키" htmlFor="embed-pk" hint="브라우저 위젯에서 사용(공개 안전)">
                <Input id="embed-pk" value={pk} readOnly className="font-mono" />
              </Field>
              <Field label="API endpoint" htmlFor="embed-endpoint" hint="위젯/SDK 가 호출할 베이스 URL">
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
          )}
        </CardContent>
      </Card>

      {/* 스니펫 */}
      <Card>
        <CardContent>
          <Tabs defaultValue="react">
            <TabsList>
              <TabsTrigger value="react">React 위젯</TabsTrigger>
              <TabsTrigger value="vanilla">스크립트 태그</TabsTrigger>
              <TabsTrigger value="server">서버 SDK</TabsTrigger>
            </TabsList>

            <TabsContent value="react" className="space-y-4 pt-5">
              <div>
                <p className="mb-2 text-sm font-medium text-text">1. 패키지 설치</p>
                <CodeBlock code={installWidgetSnippet()} language="bash" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text">2. 신고 버튼</p>
                <CodeBlock code={reactReportSnippet(cfg)} language="tsx" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text">3. 작성 중 사전검사 배지(선택)</p>
                <CodeBlock code={reactBadgeSnippet(cfg)} language="tsx" />
              </div>
              <p className="text-xs text-text-subtle">
                <Badge tone="info" size="sm">
                  팁
                </Badge>{' '}
                사전검사는 UX 힌트입니다. 최종 차단은 반드시 서버(secret 키)에서 하세요.
              </p>
            </TabsContent>

            <TabsContent value="vanilla" className="space-y-4 pt-5">
              <p className="text-sm text-text-muted">
                비-React 사이트는 IIFE 빌드를 불러오고{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                  ModerationDesk.init
                </code>{' '}
                한 번만 호출합니다.
              </p>
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
              <p className="text-xs text-text-subtle">
                <Badge tone="warning" size="sm">
                  참고
                </Badge>{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                  report-button.js
                </code>{' '}
                는 위젯 패키지의 IIFE 빌드 산출물입니다. 셀프호스팅 시 정적 파일로 함께 배포하세요.
              </p>
            </TabsContent>

            <TabsContent value="server" className="space-y-4 pt-5">
              <div>
                <p className="mb-2 text-sm font-medium text-text">1. SDK 설치</p>
                <CodeBlock code={installSdkSnippet()} language="bash" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text">2. 콘텐츠 게이트</p>
                <CodeBlock code={serverSnippet(cfg)} language="ts" />
              </div>
              <p className="text-xs text-text-subtle">
                <Badge tone="danger" size="sm">
                  보안
                </Badge>{' '}
                secret 키(sk_…)는 서버 환경 변수로만 보관하세요. 브라우저 번들에 넣지 마세요.
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
        에서 실제 신고·사전검사를 체험할 수 있습니다.
        <div className="mt-3">
          <Button asChild size="sm" variant="secondary">
            <Link to="/demo">위젯 데모 열기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
