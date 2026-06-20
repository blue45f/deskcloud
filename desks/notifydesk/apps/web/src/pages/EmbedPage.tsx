import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiBaseUrl } from '@/services/api'
import { useTenant } from '@/services/notifications'
import { installSnippet, reactSnippet, serverSendSnippet, vanillaSnippet } from '@/utils/embed'

export default function EmbedPage() {
  useDocumentTitle('임베드')
  const tenant = useTenant()
  const endpoint = apiBaseUrl()

  const [recipientId, setRecipientId] = useState('user_42')
  const [accent, setAccent] = useState('#2f5fe0')

  const publishableKey = tenant.data?.publishableKey ?? 'pk_…'
  const cfg = { publishableKey, endpoint, recipientId: recipientId.trim() || 'user_42', accent }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">임베드</h1>
        <p className="mt-1 text-sm text-text-muted">
          브라우저(인박스 벨)는 publishable 키, 서버(발송)는 secret 키. 아래 스니펫에는 이 테넌트의
          실제 키가 채워집니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>스니펫 옵션</CardTitle>
          <CardDescription>recipientId·강조색을 바꾸면 스니펫에 반영됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="recipientId (예시)" htmlFor="emb-rid">
              <Input
                id="emb-rid"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="강조색" htmlFor="emb-accent">
              <div className="flex items-center gap-2">
                <input
                  id="emb-accent"
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
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-subtle">
            <span>endpoint</span>
            <Badge tone="outline" size="sm">
              {endpoint}
            </Badge>
            <span>publishable</span>
            {tenant.isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <Badge tone="accent" size="sm">
                {publishableKey}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Tabs defaultValue="react">
            <TabsList>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="vanilla">스크립트 태그</TabsTrigger>
              <TabsTrigger value="server">서버 발송(SDK)</TabsTrigger>
              <TabsTrigger value="install">설치</TabsTrigger>
            </TabsList>

            <TabsContent value="react" className="pt-4">
              <p className="mb-3 text-sm text-text-muted">
                React 앱에 알림 벨을 추가합니다. publishable 키는 브라우저 노출이 안전합니다.
              </p>
              <CodeBlock code={reactSnippet(cfg)} language="tsx" />
            </TabsContent>

            <TabsContent value="vanilla" className="pt-4">
              <p className="mb-3 text-sm text-text-muted">
                비-React 사이트는 IIFE 스크립트 + <code className="font-mono">NotifyDesk.init</code>{' '}
                한 번.
              </p>
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
            </TabsContent>

            <TabsContent value="server" className="pt-4">
              <p className="mb-3 text-sm text-text-muted">
                서버에서 secret 키로 발송합니다. secret 키는 환경변수로만 — 브라우저/리포지토리에
                넣지 마세요.
              </p>
              <CodeBlock
                code={serverSendSnippet({ endpoint, recipientId: cfg.recipientId })}
                language="ts"
              />
            </TabsContent>

            <TabsContent value="install" className="pt-4">
              <p className="mb-3 text-sm text-text-muted">패키지 설치.</p>
              <CodeBlock code={installSnippet()} language="bash" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
