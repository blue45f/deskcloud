import { KeyRound } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { CopyButton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { publicEndpoint } from '@/services/api'
import { useTenant } from '@/services/chat'
import { installSnippet, reactSnippet, serverSnippet, vanillaSnippet } from '@/utils/embed'

const STEPS = [
  {
    n: 1,
    title: '가입해 키를 발급받으세요',
    body: '가입 시 브라우저용 publishable 키(pk_)와 서버용 secret 키(sk_)를 받습니다. sk_ 평문은 발급 시 1회만 노출됩니다.',
  },
  {
    n: 2,
    title: '아래 스니펫을 앱에 붙여넣으세요',
    body: 'React 앱이면 컴포넌트를, 그 외 사이트면 스크립트 한 줄을 추가합니다. 백엔드에서는 SDK 로 대화를 생성·발송합니다.',
  },
  {
    n: 3,
    title: '브라우저는 pk로 메시지를 주고받습니다',
    body: '위젯은 pk + memberId 로 자신이 속한 대화에 연결되고, 운영자는 이 콘솔에서 전체 대화를 모니터합니다.',
  },
]

export default function EmbedPage() {
  useDocumentTitle('임베드')

  const { data: tenant } = useTenant()

  const [endpoint, setEndpoint] = useState(publicEndpoint())
  const [memberId, setMemberId] = useState('current-user-id')
  const [accent, setAccent] = useState('#c08a3e')

  const publishableKey = tenant?.publishableKey ?? 'pk_…'

  const cfg = {
    publishableKey: tenant?.publishableKey ?? '',
    endpoint,
    memberId,
    accent,
  }

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">임베드</h1>
        <p className="mt-1 max-w-2xl text-pretty text-text-muted">
          ChatDesk 채팅 위젯을 여러분의 앱에 붙이는 방법입니다. 아래 스니펫에는 이 테넌트의 실제
          publishable 키가 채워져 있어, 복사해 바로 사용할 수 있습니다.
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
          <Field
            label="Publishable 키 (pk_)"
            htmlFor="embed-pk"
            hint="브라우저에 노출되는 공개 키입니다. 스니펫에 자동으로 채워집니다."
          >
            <div className="flex items-center gap-2">
              <Input
                id="embed-pk"
                value={publishableKey}
                readOnly
                className="font-mono"
                aria-label="Publishable 키"
              />
              <CopyButton value={publishableKey} label="publishable 키 복사" />
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="API endpoint"
              htmlFor="embed-endpoint"
              hint="위젯이 호출할 ChatDesk API 베이스 URL"
            >
              <Input
                id="embed-endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field
              label="데모 멤버 id"
              htmlFor="embed-member"
              hint="스니펫 예시에 쓰일 호스트 앱의 사용자 id"
            >
              <Input
                id="embed-member"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="font-mono"
              />
            </Field>
          </div>

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
        </CardContent>
      </Card>

      {/* 스니펫 */}
      <Card>
        <CardContent>
          <Tabs defaultValue="react">
            <TabsList>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="vanilla">스크립트 태그</TabsTrigger>
              <TabsTrigger value="server">서버</TabsTrigger>
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
                로그인 사용자의 id 를{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">memberId</code>{' '}
                로 넘기면 그 멤버가 속한 대화에 자동으로 연결됩니다.
              </p>
            </TabsContent>

            <TabsContent value="vanilla" className="space-y-4 pt-5">
              <p className="text-sm text-text-muted">
                비-React 사이트는 IIFE 빌드를 불러오고{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                  ChatDesk.init
                </code>{' '}
                한 번만 호출하면 됩니다.
              </p>
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
              <p className="text-xs text-text-subtle">
                <Badge tone="warning" size="sm">
                  참고
                </Badge>{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                  chat-widget.js
                </code>{' '}
                는 위젯 패키지의 IIFE 빌드 산출물입니다. 셀프호스팅 시 정적 파일로 함께 배포하세요.
              </p>
            </TabsContent>

            <TabsContent value="server" className="space-y-4 pt-5">
              <p className="text-sm text-text-muted">
                호스트 백엔드는 secret 키(sk_)로 대화를 생성하고, 시스템 공지를 발송하며, 강화 인증용
                멤버 토큰을 발급합니다.
              </p>
              <CodeBlock code={serverSnippet({ endpoint })} language="ts" />
              <p className="flex items-start gap-2 text-xs text-text-subtle">
                <KeyRound className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                <span>
                  <Badge tone="danger" size="sm">
                    보안
                  </Badge>{' '}
                  secret 키(sk_)는 절대 브라우저에 노출하지 마세요. 서버 환경변수로만 두고, 위젯에는
                  publishable 키(pk_)만 전달합니다.
                </span>
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
