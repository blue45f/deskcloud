import { FeedbackWidget, type WidgetPosition } from '@surveydesk/widget'
import { ArrowLeft, Moon, Sun, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from '@/lib/firebaseAuth'

const POSITIONS: { value: WidgetPosition; label: string }[] = [
  { value: 'bottom-right', label: '우하단' },
  { value: 'bottom-left', label: '좌하단' },
  { value: 'top-right', label: '우상단' },
  { value: 'top-left', label: '좌상단' },
]

/** 위젯 라이브 데모(공개) — 실제 <FeedbackWidget> 을 띄워 활성 설문을 받아 제출까지 체험. */
export default function DemoPage() {
  useDocumentTitle('위젯 데모')
  const { resolved, toggle } = useTheme()

  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    window.location.origin

  const [appId, setAppId] = useState('demo')
  const [endpoint, setEndpoint] = useState(apiBase)
  const [accent, setAccent] = useState('#2f5fe0')
  const [position, setPosition] = useState<WidgetPosition>('bottom-right')
  // key 로 위젯을 재마운트해 설정 변경을 반영.
  const [nonce, setNonce] = useState(0)
  const remount = () => setNonce((n) => n + 1)

  // 회원 로그인 시 응답을 그 회원에게 귀속한다 — 통합 로그인 모듈의 실제 사용처 데모.
  // 게스트(익명)·비로그인이면 익명 응답으로 보낸다(respondent 미전송).
  const { user } = useAuth()
  const respondent = useMemo(
    () =>
      user && !user.isAnonymous
        ? { userId: user.uid, ...(user.email ? { email: user.email } : {}) }
        : undefined,
    [user]
  )
  const respondentName = user?.isAnonymous ? null : (user?.email ?? null)

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
            <MemberAuthControl />
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
            아래 설정으로 실제 임베드 위젯이 이 페이지에 떠 있습니다. 떠 있는{' '}
            <strong className="font-semibold text-text">피드백</strong> 버튼을 눌러 활성 설문에
            응답해 보세요. 제출은 실제 API 로 전송됩니다.
          </p>
          {respondentName ? (
            <p className="mt-3">
              <Badge tone="success">
                <UserCheck className="size-3.5" aria-hidden />
                <span className="truncate">{respondentName} 으로 귀속</span>
              </Badge>
              <span className="ml-2 text-xs text-text-subtle">
                로그인 회원이라 응답이 이 계정에 귀속됩니다.
              </span>
            </p>
          ) : (
            <p className="mt-3 text-xs text-text-subtle">
              로그인하면 데모 응답이 회원 계정에 귀속됩니다(현재는 익명 응답).
            </p>
          )}
        </div>

        <Card className="mt-8 max-w-2xl">
          <CardHeader>
            <CardTitle>위젯 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="appId (테넌트)" htmlFor="demo-appid" hint="시드: demo · offhours">
                <Input
                  id="demo-appid"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
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
              <Field label="위치" htmlFor="demo-position">
                <Select
                  id="demo-position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as WidgetPosition)}
                >
                  {POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={remount}>
                설정 적용(위젯 재마운트)
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 max-w-2xl text-sm text-text-subtle">
          활성 설문이 없으면 버튼이 조용히 숨겨집니다. 설문을 구성하려면{' '}
          <Link to="/app/editor" className="font-medium text-accent-strong hover:text-accent">
            설문 에디터
          </Link>{' '}
          로 이동하세요(로그인 필요).
        </p>
      </main>

      <FeedbackWidget
        key={`${nonce}-${appId}-${endpoint}-${accent}-${position}-${respondent?.userId ?? 'anon'}`}
        appId={appId.trim() || 'demo'}
        endpoint={endpoint.trim() || apiBase}
        accent={accent}
        position={position}
        respondent={respondent}
        onSubmitted={(r) => {
          toast.success('응답이 제출되었습니다. 감사합니다!')
          console.info('[demo] submitted', r)
        }}
      />
    </div>
  )
}
