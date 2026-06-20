import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAppIdStore } from '@/app/appIdStore'
import { AppIdSelector } from '@/components/feature/AppIdSelector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { installSnippet, reactSnippet, vanillaSnippet } from '@/utils/embed'

const STEPS = [
  {
    n: 1,
    title: '설문을 만들고 활성화하세요',
    body: '설문 에디터에서 질문을 구성하고 활성화하면 appId당 활성본 1개가 위젯에 노출됩니다.',
  },
  {
    n: 2,
    title: '아래 스니펫을 앱에 붙여넣으세요',
    body: 'React 앱이면 컴포넌트를, 그 외 사이트면 스크립트 한 줄을 추가합니다.',
  },
  {
    n: 3,
    title: '응답이 대시보드로 흘러들어옵니다',
    body: '위젯 제출은 공개 엔드포인트로 전송되고, 집계는 대시보드에서 실시간으로 확인합니다.',
  },
]

export default function IntegrationGuidePage() {
  useDocumentTitle('임베드 가이드')
  const appId = useAppIdStore((s) => s.appId)

  const defaultEndpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    window.location.origin
  const [endpoint, setEndpoint] = useState(defaultEndpoint)
  const [accent, setAccent] = useState('#2f5fe0')

  const cfg = { appId, endpoint, accent }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">임베드 가이드</h1>
        <p className="mt-1 max-w-2xl text-pretty text-text-muted">
          형제 앱에 SurveyDesk 위젯을 붙이는 방법입니다. 위젯은 의존성이 적고(React 는 peer),
          외부 CSS 프레임워크 없이 스코프 스타일로 동작합니다.
        </p>
      </div>

      {/* 단계 */}
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

      {/* 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>스니펫 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AppIdSelector />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="API endpoint" htmlFor="guide-endpoint" hint="위젯이 호출할 SurveyDesk API 베이스 URL">
              <Input
                id="guide-endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="강조색 (선택)" htmlFor="guide-accent">
              <div className="flex items-center gap-2">
                <input
                  id="guide-accent"
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

      {/* 스니펫 */}
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
                <Badge tone="info" size="sm">팁</Badge> 로그인 사용자가 있으면{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">respondent</code>{' '}
                prop 으로 응답을 귀속할 수 있습니다.
              </p>
            </TabsContent>

            <TabsContent value="vanilla" className="space-y-4 pt-5">
              <p className="text-sm text-text-muted">
                비-React 사이트는 IIFE 빌드를 불러오고 <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">SurveyDesk.init</code> 한 번만 호출하면 됩니다.
              </p>
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
              <p className="text-xs text-text-subtle">
                <Badge tone="warning" size="sm">참고</Badge>{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">feedback-widget.js</code>{' '}
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
        에서 실제 제출까지 체험할 수 있습니다.
        <div className="mt-3">
          <Button asChild size="sm" variant="secondary">
            <Link to="/demo">위젯 데모 열기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
