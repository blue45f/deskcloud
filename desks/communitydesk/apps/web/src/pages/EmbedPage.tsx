import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { EmptyState, Spinner } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { API_BASE } from '@/services/api'
import { listBoards, getTenant } from '@/services/community'
import { adminSnippet, installSnippet, reactSnippet, vanillaSnippet } from '@/utils/embed'

const STEPS = [
  {
    n: 1,
    title: '게시판·카페를 만드세요',
    body: '게시판 탭에서 slug·이름·종류를 정하면, 그 slug 를 위젯에 연결합니다.',
  },
  {
    n: 2,
    title: '아래 스니펫을 앱에 붙여넣으세요',
    body: 'React 앱이면 컴포넌트를, 그 외 사이트면 스크립트 한 줄. publishable 키만 노출합니다.',
  },
  {
    n: 3,
    title: '글·댓글이 검수 큐로 흘러들어옵니다',
    body: '엔드유저 작성은 공개 엔드포인트로 전송되고, 운영은 검수 큐에서 합니다.',
  },
]

export default function EmbedPage() {
  useDocumentTitle('임베드')

  const tenantQ = useQuery({ queryKey: ['tenant'], queryFn: getTenant })
  const boardsQ = useQuery({ queryKey: ['boards'], queryFn: listBoards })

  const endpoint = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
  const publishableKey = tenantQ.data?.publishableKey ?? 'pk_...'

  const boards = boardsQ.data ?? []
  const [boardSlug, setBoardSlug] = useState('')
  const [accent, setAccent] = useState('#2f5fe0')

  const effectiveSlug = boardSlug || boards[0]?.slug || 'general'
  const cfg = { publishableKey, endpoint, boardSlug: effectiveSlug, accent }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">임베드</h1>
        <p className="mt-1 max-w-2xl text-pretty text-text-muted">
          호스트 앱에 CommunityDesk 게시판을 붙이는 방법입니다. 위젯은 의존성이 적고(React 는
          peer), 외부 CSS 프레임워크 없이 스코프 스타일로 동작합니다.
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
        <CardHeader
          action={
            tenantQ.data ? (
              <Badge tone="info" size="sm">
                {tenantQ.data.name}
              </Badge>
            ) : null
          }
        >
          <CardTitle>스니펫 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tenantQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Spinner /> 키를 불러오는 중…
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="게시판 slug" htmlFor="embed-board">
              {boards.length > 0 ? (
                <Select
                  id="embed-board"
                  value={effectiveSlug}
                  onChange={(e) => setBoardSlug(e.target.value)}
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.slug}>
                      {b.name} ({b.slug})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="embed-board"
                  value={boardSlug}
                  onChange={(e) => setBoardSlug(e.target.value)}
                  placeholder="general"
                  className="font-mono"
                />
              )}
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
            <Field label="API endpoint" htmlFor="embed-endpoint" hint="위젯이 호출할 베이스 URL">
              <Input id="embed-endpoint" value={endpoint} readOnly className="font-mono" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {boards.length === 0 && !boardsQ.isLoading ? (
        <EmptyState
          title="아직 게시판이 없습니다"
          description="게시판 탭에서 게시판이나 카페를 먼저 만들면 위젯에 연결할 slug 가 생깁니다."
        />
      ) : null}

      <Card>
        <CardContent>
          <Tabs defaultValue="react">
            <TabsList>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="vanilla">스크립트 태그</TabsTrigger>
              <TabsTrigger value="admin">서버(검수)</TabsTrigger>
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
            </TabsContent>

            <TabsContent value="vanilla" className="pt-5">
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
            </TabsContent>

            <TabsContent value="admin" className="space-y-3 pt-5">
              <p className="text-sm text-text-muted">
                검수·운영은 <strong className="text-text">secret 키</strong> 로만 합니다(브라우저
                노출 금지). 서버에서 admin SDK 로 호출하세요.
              </p>
              <CodeBlock code={adminSnippet({ endpoint })} language="ts" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
