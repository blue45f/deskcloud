import {
  ReviewForm,
  ReviewList,
  ReviewStars,
  TestimonialWall,
} from '@reviewdesk/widget'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * 위젯 라이브 데모(공개) — 실제 4개 위젯을 띄워 제출·집계까지 체험.
 * 기본값은 시드 데모 테넌트(pk_demo, subject: pro-plan / landing).
 */
export default function DemoPage() {
  useDocumentTitle('위젯 데모')
  const { resolved, toggle } = useTheme()

  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    window.location.origin

  const [publishableKey, setPublishableKey] = useState('pk_demo')
  const [endpoint, setEndpoint] = useState(apiBase)
  const [subjectId, setSubjectId] = useState('pro-plan')
  const [accent, setAccent] = useState('#2f5fe0')
  // key 로 위젯을 재마운트해 설정 변경을 반영.
  const [nonce, setNonce] = useState(0)
  const remount = () => setNonce((n) => n + 1)

  const cfg = {
    publishableKey: publishableKey.trim() || 'pk_demo',
    endpoint: endpoint.trim() || apiBase,
    accent,
  }
  const k = `${nonce}-${cfg.publishableKey}-${cfg.endpoint}-${subjectId}-${accent}`

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
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-text">
            위젯 라이브 데모
          </h1>
          <p className="mt-2 text-pretty text-text-muted">
            실제 임베드 위젯 4종이 아래에 떠 있습니다. 폼에서{' '}
            <strong className="font-semibold text-text">리뷰를 제출</strong>하면 실제 API 로
            전송되고(검수 대기), 운영자가 승인하면 목록·집계·후기 월에 반영됩니다. 기본값은 시드
            데모 테넌트입니다.
          </p>
        </div>

        {/* 설정 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>위젯 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="publishable 키"
                htmlFor="demo-pk"
                hint="시드: pk_demo (CORS *)"
              >
                <Input
                  id="demo-pk"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
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
              <Field label="subjectId" htmlFor="demo-subject" hint="시드: pro-plan · landing">
                <Input
                  id="demo-subject"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
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
            </div>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={remount}>
                설정 적용(위젯 재마운트)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 위젯 갤러리 */}
        <section className="mt-10 space-y-10" aria-label="위젯 미리보기">
          <WidgetBlock title="별점 배지 — ReviewStars" caption="제품명 옆 컴팩트 배지(평균 별 + 건수).">
            <ReviewStars key={`stars-${k}`} {...cfg} subjectId={subjectId} />
          </WidgetBlock>

          <WidgetBlock title="후기 월 — TestimonialWall" caption="추천(featured) 후기 그리드.">
            <TestimonialWall key={`wall-${k}`} {...cfg} limit={6} />
          </WidgetBlock>

          <div className="grid gap-10 lg:grid-cols-2">
            <WidgetBlock title="리뷰 목록 — ReviewList" caption="집계 헤더 + 분포 막대 + 승인본 목록.">
              <ReviewList key={`list-${k}`} {...cfg} subjectId={subjectId} limit={5} />
            </WidgetBlock>
            <WidgetBlock title="리뷰 작성 — ReviewForm" caption="별점 picker + 입력 → 제출(검수 대기).">
              <ReviewForm
                key={`form-${k}`}
                {...cfg}
                subjectId={subjectId}
                subjectLabel="데모"
                collectEmail
                onSubmitted={(r) => {
                  toast.success('리뷰가 제출되었습니다. 검수 후 노출됩니다!')
                  console.info('[demo] submitted', r)
                }}
              />
            </WidgetBlock>
          </div>
        </section>

        <p className="mt-10 max-w-2xl text-sm text-text-subtle">
          제출한 리뷰를 노출하려면{' '}
          <Link to="/login" className="font-medium text-accent-strong hover:text-accent">
            로그인
          </Link>{' '}
          후 검수 대시보드에서 승인하세요(데모 테넌트 secret 키: <code className="font-mono">sk_demo</code>).
        </p>
      </main>
    </div>
  )
}

function WidgetBlock({
  title,
  caption,
  children,
}: {
  title: string
  caption: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <p className="text-xs text-text-subtle">{caption}</p>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-surface/50 p-5">{children}</div>
    </div>
  )
}
