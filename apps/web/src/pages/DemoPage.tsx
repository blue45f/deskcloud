import { NotificationBell, type WidgetAlign } from '@notifydesk/widget'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiBaseUrl } from '@/services/api'

const ALIGNS: { value: WidgetAlign; label: string }[] = [
  { value: 'right', label: '오른쪽 정렬' },
  { value: 'left', label: '왼쪽 정렬' },
]

/**
 * 위젯 라이브 데모(공개) — 데모 테넌트(pk_demo)의 인박스를 실제 <NotificationBell> 로 띄운다.
 * 시드된 알림(미읽음 혼합)을 받아, 벨을 열면 읽음 처리까지 동작한다.
 */
export default function DemoPage() {
  useDocumentTitle('위젯 데모')
  const { resolved, toggle } = useTheme()

  const apiBase = apiBaseUrl()

  const [publishableKey, setPublishableKey] = useState('pk_demo')
  const [recipientId, setRecipientId] = useState('user_demo')
  const [endpoint, setEndpoint] = useState(apiBase)
  const [accent, setAccent] = useState('#2f5fe0')
  const [align, setAlign] = useState<WidgetAlign>('right')
  const [nonce, setNonce] = useState(0)
  const remount = () => setNonce((n) => n + 1)

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
            알림 벨 라이브 데모
          </h1>
          <p className="mt-2 text-pretty text-text-muted">
            아래 설정으로 실제 알림 벨 위젯이 떠 있습니다. 우측 상단의 벨을 눌러 데모 인박스를 열어
            보세요. 시드된 알림이 미읽음으로 표시되고, 벨을 열면 읽음 처리됩니다.
          </p>
        </div>

        <Card className="mt-8 max-w-2xl">
          <CardHeader
            action={
              <NotificationBell
                key={`hdr-${nonce}-${publishableKey}-${recipientId}-${endpoint}-${accent}-${align}`}
                recipientId={recipientId.trim() || 'user_demo'}
                publishableKey={publishableKey.trim() || 'pk_demo'}
                endpoint={endpoint.trim() || apiBase}
                accent={accent}
                align={align}
                pollIntervalMs={5000}
              />
            }
          >
            <CardTitle>위젯 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="publishable 키" htmlFor="demo-pk" hint="시드: pk_demo">
                <Input
                  id="demo-pk"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="recipientId" htmlFor="demo-rid" hint="시드: user_demo">
                <Input
                  id="demo-rid"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
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
              <Field label="드롭다운 정렬" htmlFor="demo-align">
                <Select
                  id="demo-align"
                  value={align}
                  onChange={(e) => setAlign(e.target.value as WidgetAlign)}
                >
                  {ALIGNS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
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
          이 데모는 데모 테넌트의 publishable 키로 동작합니다. 내 테넌트로 보내려면{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            가입
          </Link>{' '}
          해 키를 받고, 대시보드에서 발송하세요.
        </p>
      </main>
    </div>
  )
}
