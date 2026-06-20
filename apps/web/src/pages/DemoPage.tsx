import { CommunityBoard } from '@communitydesk/widget'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { API_BASE } from '@/services/api'

const DEMO_BOARDS = [
  { slug: 'free', label: '자유게시판 (board)' },
  { slug: 'notice', label: '공지사항 (board)' },
  { slug: 'dev-cafe', label: '개발자 카페 (cafe)' },
]

/**
 * 위젯 라이브 데모(공개) — 실제 <CommunityBoard> 를 띄워 데모 테넌트(pk_demo)의 게시판을
 * 그대로 보여 준다. memberId 를 넣으면 글/댓글/반응 작성 UI 가 켜진다.
 */
export default function DemoPage() {
  useDocumentTitle('위젯 데모')
  const { resolved, toggle } = useTheme()

  const apiBase =
    API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4096')

  const [publishableKey, setPublishableKey] = useState('pk_demo')
  const [endpoint, setEndpoint] = useState(apiBase)
  const [boardSlug, setBoardSlug] = useState('free')
  const [accent, setAccent] = useState('#2f5fe0')
  const [memberName, setMemberName] = useState('데모 방문자')
  const [asMember, setAsMember] = useState(true)
  // key 로 위젯을 재마운트해 설정 변경을 반영.
  const [nonce, setNonce] = useState(0)
  const remount = () => setNonce((n) => n + 1)

  const memberId = asMember ? 'demo-visitor' : undefined

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="홈으로">
            <Brand />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="size-4" /> 홈
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={toggle}
              aria-label={resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {resolved === 'dark' ? (
                <Sun className="size-[1.05rem]" />
              ) : (
                <Moon className="size-[1.05rem]" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-12 outline-none sm:px-6"
      >
        <div className="max-w-2xl">
          <Badge tone="accent" size="sm">
            라이브 위젯
          </Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-text">
            임베드 게시판, 실제로 떠 있는 모습
          </h1>
          <p className="mt-2 text-pretty text-text-muted">
            아래는 호스트 앱에 붙는 것과 동일한{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
              &lt;CommunityBoard /&gt;
            </code>{' '}
            위젯입니다. 시드된 데모 테넌트(
            <span className="font-mono text-text">pk_demo</span>)의 게시판을 그대로 읽고, 멤버로
            글·댓글·반응까지 남길 수 있습니다. 작성은 실제 공개 API 로 전송됩니다.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
          {/* 설정 패널 */}
          <Card>
            <CardHeader>
              <CardTitle>위젯 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="publishable 키" htmlFor="demo-pk" hint="시드: pk_demo">
                <Input
                  id="demo-pk"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="게시판 slug" htmlFor="demo-board">
                <Select
                  id="demo-board"
                  value={boardSlug}
                  onChange={(e) => setBoardSlug(e.target.value)}
                >
                  {DEMO_BOARDS.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="API endpoint" htmlFor="demo-endpoint">
                <Input
                  id="demo-endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="강조색" htmlFor="demo-accent">
                <div className="flex items-center gap-2">
                  <input
                    id="demo-accent"
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
              <Field
                label="작성자 이름"
                htmlFor="demo-member"
                hint="멤버로 보면 글·댓글·반응 작성 UI 가 켜집니다."
              >
                <Input
                  id="demo-member"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  disabled={!asMember}
                />
              </Field>
              <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
                <label htmlFor="demo-as-member" className="text-sm text-text">
                  멤버로 보기 (작성 가능)
                </label>
                <input
                  id="demo-as-member"
                  type="checkbox"
                  checked={asMember}
                  onChange={(e) => setAsMember(e.target.checked)}
                  className="size-4 cursor-pointer accent-[var(--color-accent)]"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={remount} className="w-full">
                설정 적용 (위젯 재마운트)
              </Button>
            </CardContent>
          </Card>

          {/* 라이브 위젯 */}
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-xs text-text-subtle">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              호스트 앱 안의 위젯 미리보기
            </div>
            <CommunityBoard
              key={`${nonce}-${publishableKey}-${endpoint}-${boardSlug}-${accent}-${memberId ?? 'guest'}`}
              publishableKey={publishableKey.trim() || 'pk_demo'}
              endpoint={endpoint.trim() || apiBase}
              boardSlug={boardSlug}
              accent={accent}
              memberId={memberId}
              memberName={memberName.trim() || '데모 방문자'}
            />
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-sm text-text-subtle">
          위젯이 비어 보이면 API 가 떠 있는지(<span className="font-mono">{apiBase}</span>) 와 데모
          시드가 적용됐는지 확인하세요. 운영(고정·잠금·숨김·삭제)은{' '}
          <Link to="/login" className="font-medium text-accent-strong hover:text-accent">
            로그인
          </Link>{' '}
          후 검수 큐에서 합니다.
        </p>
      </main>
    </div>
  )
}
