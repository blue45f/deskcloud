import { useState } from 'react'

import { PageHeader } from '@/components/feature/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiBase } from '@/services/api'
import { useTenant } from '@/services/tenants'
import {
  clientSnippet,
  curlSnippet,
  hookSnippet,
  installSnippet,
  reactSnippet,
  serverSnippet,
  vanillaSnippet,
} from '@/utils/embed'

export default function EmbedPage() {
  useDocumentTitle('임베드')
  const tenant = useTenant()
  const [channel, setChannel] = useState('room:lobby')

  // 라이브 데모/스니펫이 가리킬 엔드포인트(프록시 사용 시 same-origin).
  const endpoint = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
  const publishableKey = tenant.data?.publishableKey ?? ''

  const cfg = { publishableKey, endpoint, channel }

  return (
    <>
      <PageHeader
        title="임베드 & SDK"
        description="아래 스니펫을 복사해 앱에 붙이세요. publishable 키는 브라우저용, secret 키는 서버에서만 사용합니다."
        action={
          publishableKey ? (
            <Badge tone="success" size="sm" dot>
              pk 연결됨
            </Badge>
          ) : (
            <Badge tone="warning" size="sm">
              pk 로딩 중
            </Badge>
          )
        }
      />

      <Card className="mb-6">
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="데모 채널" htmlFor="embed-channel" hint="스니펫에 채워질 채널 이름">
              <Input
                id="embed-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="font-mono"
                placeholder="room:42"
              />
            </Field>
            <Field label="엔드포인트" htmlFor="embed-endpoint" hint="API/WS 베이스 URL (읽기 전용)">
              <Input
                id="embed-endpoint"
                value={endpoint}
                readOnly
                className="font-mono text-text-muted"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>통합 스니펫</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="react">
            <TabsList className="mb-5">
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="hook">React 훅</TabsTrigger>
              <TabsTrigger value="vanilla">바닐라</TabsTrigger>
              <TabsTrigger value="client">브라우저 SDK</TabsTrigger>
              <TabsTrigger value="server">서버 SDK</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>

            <TabsContent value="react" className="space-y-3">
              <Note>
                <code className="font-mono">@realtimedesk/widget/react</code> 의{' '}
                <code className="font-mono">&lt;PresenceBar&gt;</code> — 채널 참여자를 실시간 아바타로.
              </Note>
              <CodeBlock code={installSnippet()} language="bash" />
              <CodeBlock code={reactSnippet(cfg)} language="tsx" />
            </TabsContent>

            <TabsContent value="hook" className="space-y-3">
              <Note>
                <code className="font-mono">useRealtime(channel)</code> — presence·메시지·연결 상태를
                직접 다룰 때.
              </Note>
              <CodeBlock code={hookSnippet(cfg)} language="tsx" />
            </TabsContent>

            <TabsContent value="vanilla" className="space-y-3">
              <Note>비-React 사이트 — 단일 스크립트 + init 한 줄.</Note>
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
            </TabsContent>

            <TabsContent value="client" className="space-y-3">
              <Note>
                <code className="font-mono">@realtimedesk/sdk</code> — 프레임워크 없이 직접 구독.
              </Note>
              <CodeBlock code={clientSnippet(cfg)} language="ts" />
            </TabsContent>

            <TabsContent value="server" className="space-y-3">
              <Note>
                <strong className="text-warning">서버 전용</strong> — secret 키로 발행. 절대
                브라우저 번들에 포함하지 마세요.
              </Note>
              <CodeBlock code={serverSnippet(cfg)} language="ts" />
            </TabsContent>

            <TabsContent value="curl" className="space-y-3">
              <Note>SDK 없이 REST 로 발행. sk_… 를 본인의 secret 키로 교체하세요.</Note>
              <CodeBlock code={curlSnippet(cfg)} language="bash" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.8125rem] text-pretty text-text-muted">{children}</p>
}
