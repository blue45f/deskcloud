import { useState } from 'react'

import { useSessionStore } from '@/app/sessionStore'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiEndpoint } from '@/services/api'
import { useMe } from '@/services/media'
import { installSnippet, reactSnippet, sdkSnippet, vanillaSnippet } from '@/utils/embed'

const STEPS = [
  {
    n: 1,
    title: 'publishable 키를 준비하세요',
    body: '브라우저 노출이 안전한 pk_ 키만 임베드에 씁니다. secret 키(sk_)는 서버에서만 사용하세요.',
  },
  {
    n: 2,
    title: '아래 스니펫을 앱에 붙여넣으세요',
    body: 'React 앱이면 컴포넌트를, 그 외 사이트면 스크립트 한 줄을 추가합니다.',
  },
  {
    n: 3,
    title: '업로드가 라이브러리로 들어옵니다',
    body: '위젯 업로드는 공개 엔드포인트로 전송되고, 자산 라이브러리에서 바로 확인·관리합니다.',
  },
]

export default function EmbedPage() {
  useDocumentTitle('임베드')
  const me = useMe()
  const sessionPk = useSessionStore((s) => s.publishableKey)
  const pk = sessionPk || me.data?.publishableKey || ''

  const [endpoint, setEndpoint] = useState(apiEndpoint() || window.location.origin)
  const [folder, setFolder] = useState('uploads')

  const cfg = { publishableKey: pk, endpoint, folder }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">임베드</h1>
        <p className="mt-1 max-w-2xl text-pretty text-text-muted">
          MediaDesk 업로더·갤러리를 앱에 붙이는 방법입니다. 위젯은 의존성이 적고(React 는 peer),
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Publishable 키" htmlFor="embed-pk">
              <Input id="embed-pk" value={pk} readOnly className="font-mono" />
            </Field>
            <Field label="API endpoint" htmlFor="embed-endpoint" hint="위젯이 호출할 베이스 URL">
              <Input
                id="embed-endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="기본 폴더 (선택)" htmlFor="embed-folder">
              <Input
                id="embed-folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value.replace(/[^a-z0-9/_-]/gi, ''))}
                className="font-mono"
                placeholder="예: avatars"
              />
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
              <TabsTrigger value="sdk">SDK</TabsTrigger>
            </TabsList>

            <TabsContent value="react" className="space-y-4 pt-5">
              <div>
                <p className="mb-2 text-sm font-medium text-text">1. 패키지 설치</p>
                <CodeBlock code={installSnippet()} language="bash" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text">2. 업로더 + 갤러리</p>
                <CodeBlock code={reactSnippet(cfg)} language="tsx" />
              </div>
              <p className="text-xs text-text-subtle">
                <Badge tone="info" size="sm">
                  팁
                </Badge>{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                  @mediadesk/widget
                </code>{' '}
                는 React 컴포넌트와 바닐라 로더를 모두 제공합니다.
              </p>
            </TabsContent>

            <TabsContent value="vanilla" className="space-y-4 pt-5">
              <p className="text-sm text-text-muted">
                비-React 사이트는 IIFE 빌드를 불러오고{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                  MediaDesk.init
                </code>{' '}
                한 번만 호출하면 됩니다.
              </p>
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
              <p className="text-xs text-text-subtle">
                <Badge tone="warning" size="sm">
                  참고
                </Badge>{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                  media-widget.js
                </code>{' '}
                는 위젯 패키지의 IIFE 빌드 산출물입니다.
              </p>
            </TabsContent>

            <TabsContent value="sdk" className="space-y-4 pt-5">
              <p className="text-sm text-text-muted">
                위젯 없이 직접 제어하려면 브라우저 SDK 를 쓰세요(업로드 + 변환 URL 빌더).
              </p>
              <CodeBlock code={sdkSnippet(cfg)} language="ts" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
