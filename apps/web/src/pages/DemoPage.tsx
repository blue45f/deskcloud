import { ModerationBadge, ReportButton } from '@moderationdesk/widget'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * 위젯 라이브 데모(공개) — 실제 위젯 두 가지를 띄운다.
 *   1) 사전검사 배지(useModerationCheck/ModerationBadge): 작성 중인 텍스트를 디바운스로 검사.
 *   2) 신고 버튼(ReportButton): 사유를 선택해 실제 API 로 신고를 접수.
 * 둘 다 publishable 키(pk_)로만 동작한다. 가입 시 받은 pk_ 를 입력하면 본인 테넌트로 검사·신고된다.
 */
export default function DemoPage() {
  useDocumentTitle('위젯 데모')
  const { resolved, toggle } = useTheme()

  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    window.location.origin

  // 데모 테넌트(pk_demo)를 기본값으로 — 가입 없이 바로 신고·사전검사를 체험할 수 있다.
  const [publishableKey, setPublishableKey] = useState('pk_demo')
  const [endpoint, setEndpoint] = useState(apiBase)
  const [draft, setDraft] = useState('this is spam, visit example.spam')

  const pk = publishableKey.trim()
  const ep = endpoint.trim() || apiBase
  const ready = pk.length > 0

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
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
        className="mx-auto max-w-4xl px-4 py-12 outline-none sm:px-6"
      >
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-text">
            위젯 라이브 데모
          </h1>
          <p className="mt-2 text-pretty text-text-muted">
            발급받은 <strong className="font-semibold text-text">publishable 키(pk_…)</strong> 를
            입력하면, 아래 위젯이 실제 API 로 동작합니다. 작성 중 사전검사 배지와 신고 버튼을 직접
            체험해 보세요. 키가 없다면{' '}
            <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
              가입
            </Link>
            해서 먼저 받으세요.
          </p>
        </div>

        <Card className="mt-8 max-w-2xl">
          <CardHeader>
            <CardTitle>위젯 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="publishable 키"
                htmlFor="demo-pk"
                hint="브라우저 안전. 가입/설정에서 pk_… 를 복사하세요."
              >
                <Input
                  id="demo-pk"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                  placeholder="pk_…"
                  className="font-mono"
                />
              </Field>
              <Field label="API endpoint" htmlFor="demo-endpoint">
                <Input
                  id="demo-endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* 사전검사 배지 데모 */}
        <Card className="mt-6 max-w-2xl">
          <CardHeader>
            <CardTitle>작성 중 사전검사</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field
              label="댓글 작성"
              htmlFor="demo-draft"
              hint="입력을 멈추면 검사합니다. 금칙어를 포함하면 아래에 경고 배지가 뜹니다."
            >
              <Textarea
                id="demo-draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  ready ? '여기에 댓글을 입력해 보세요…' : '먼저 publishable 키를 입력하세요.'
                }
                disabled={!ready}
              />
            </Field>
            <div className="min-h-6">
              {ready ? (
                <ModerationBadge text={draft} publishableKey={pk} endpoint={ep} />
              ) : (
                <Badge tone="neutral" size="sm">
                  publishable 키를 입력하면 활성화됩니다
                </Badge>
              )}
            </div>
            <p className="text-xs text-text-subtle">
              사전검사는 UX 힌트일 뿐입니다. 실제 차단은 서버(secret 키)가 결정합니다.
            </p>
          </CardContent>
        </Card>

        {/* 신고 버튼 데모 */}
        <Card className="mt-6 max-w-2xl">
          <CardHeader>
            <CardTitle>신고 버튼</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-2 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">예시 댓글</p>
                <p className="mt-0.5 text-sm text-text-muted">
                  이 콘텐츠 옆의 버튼으로 신고를 접수해 보세요. 제출은 실제 API 로 전송됩니다.
                </p>
              </div>
              {ready ? (
                <ReportButton
                  subjectType="comment"
                  subjectId="demo-c-1"
                  publishableKey={pk}
                  endpoint={ep}
                  onSubmitted={(r) => {
                    toast.success('신고가 접수되었습니다. 감사합니다!')
                    console.info('[demo] reported', r)
                  }}
                />
              ) : (
                <Button variant="secondary" size="sm" disabled>
                  키 필요
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 max-w-2xl text-sm text-text-subtle">
          접수된 신고는{' '}
          <Link to="/app/reports" className="font-medium text-accent-strong hover:text-accent">
            신고 큐
          </Link>{' '}
          에서 확인할 수 있습니다(로그인 필요).
        </p>
      </main>
    </div>
  )
}
