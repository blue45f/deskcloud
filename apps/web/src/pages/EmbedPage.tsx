import { SearchBox, SearchPalette } from '@searchdesk/widget'
import { Command, KeyRound, Terminal } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuthStore } from '@/app/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { EmptyState } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTenant } from '@/services/searchdesk'
import {
  indexSnippet,
  installSnippet,
  reactBoxSnippet,
  reactPaletteSnippet,
  vanillaSnippet,
} from '@/utils/embed'

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  (typeof window !== 'undefined' ? window.location.origin : 'https://search.example.com')

export default function EmbedPage() {
  useDocumentTitle('임베드')
  const creds = useAuthStore((s) => s.creds)
  const tenant = useTenant()

  const publishableKey = tenant.data?.publishableKey ?? creds.publishableKey
  const [accent, setAccent] = useState('#2f5fe0')
  const [index, setIndex] = useState('')
  const [open, setOpen] = useState(false)

  if (!publishableKey) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-text">임베드</h1>
        </header>
        <Card>
          <CardContent>
            <EmptyState
              icon={KeyRound}
              title="publishable 키가 필요합니다"
              description="임베드 스니펫은 pk_ 키로 동작합니다. 설정에서 키를 로테이션하면 pk_ 가 다시 표시됩니다."
              action={
                <Button asChild size="sm" variant="accent">
                  <Link to="/app/settings">설정으로</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const cfg = { publishableKey, endpoint: API_BASE, accent, index: index.trim() || undefined }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-text">임베드</h1>
        <p className="mt-1 text-sm text-text-muted">
          ⌘K 커맨드 팔레트·인라인 박스를 한 줄로 붙입니다. 검색에는 publishable 키만 씁니다.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>스니펫 설정</CardTitle>
          <CardDescription>
            강조색·인덱스를 바꾸면 아래 코드와 미리보기가 갱신됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="강조색" htmlFor="embed-accent">
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
            <Field label="인덱스" htmlFor="embed-index" hint="미지정 시 default">
              <Input
                id="embed-index"
                value={index}
                onChange={(e) => setIndex(e.target.value)}
                placeholder="default"
                className="font-mono"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Tabs defaultValue="vanilla">
            <TabsList>
              <TabsTrigger value="vanilla">스크립트(⌘K)</TabsTrigger>
              <TabsTrigger value="react-palette">React 팔레트</TabsTrigger>
              <TabsTrigger value="react-box">React 박스</TabsTrigger>
              <TabsTrigger value="server">서버 색인</TabsTrigger>
            </TabsList>

            <TabsContent value="vanilla" className="space-y-3 pt-4">
              <p className="text-sm text-text-muted">
                비-React 사이트: IIFE 스크립트 + init 한 줄.{' '}
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">⌘K</kbd> (또는{' '}
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">Ctrl K</kbd>
                )로 열립니다.
              </p>
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
            </TabsContent>

            <TabsContent value="react-palette" className="space-y-3 pt-4">
              <p className="text-sm text-text-muted">React 앱: ⌘K 팔레트 컴포넌트.</p>
              <CodeBlock code={installSnippet()} language="bash" />
              <CodeBlock code={reactPaletteSnippet(cfg)} language="tsx" />
            </TabsContent>

            <TabsContent value="react-box" className="space-y-3 pt-4">
              <p className="text-sm text-text-muted">
                React 앱: 페이지에 자리 잡는 인라인 검색 박스.
              </p>
              <CodeBlock code={reactBoxSnippet(cfg)} language="tsx" />
            </TabsContent>

            <TabsContent value="server" className="space-y-3 pt-4">
              <p className="text-sm text-text-muted">
                서버에서 secret 키(sk_)로 문서를 색인합니다.{' '}
                <strong className="text-text">secret 키는 브라우저에 넣지 마세요.</strong>
              </p>
              <CodeBlock
                code={indexSnippet({ endpoint: API_BASE, index: index.trim() || undefined })}
                language="ts"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 라이브 미리보기 */}
      <Card>
        <CardHeader
          action={
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              <Command className="size-4" /> 팔레트 열기
            </Button>
          }
        >
          <CardTitle>라이브 미리보기</CardTitle>
          <CardDescription>
            이 테넌트의 키로 실제 검색합니다(이 페이지의 문서가 검색됨). 인라인 박스에 입력해
            보세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <SearchBox
              key={`box-${accent}-${index}`}
              publishableKey={publishableKey}
              endpoint={API_BASE}
              indexName={index.trim() || undefined}
              accent={accent}
              placeholder="문서 검색…"
            />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-text-subtle">
            <Terminal className="size-3.5" aria-hidden />
            ⌘K 데모 페이지는{' '}
            <Link to="/demo" className="text-accent-strong hover:text-accent">
              /demo
            </Link>{' '}
            에서도 공개로 볼 수 있습니다.
          </p>
        </CardContent>
      </Card>

      {/* 제어형 팔레트(버튼으로 열기) */}
      <SearchPalette
        publishableKey={publishableKey}
        endpoint={API_BASE}
        indexName={index.trim() || undefined}
        accent={accent}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}
