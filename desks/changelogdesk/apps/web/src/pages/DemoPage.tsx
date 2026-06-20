import { ChangelogWidget, type WidgetPosition } from '@changelogdesk/widget'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const POSITIONS: { value: WidgetPosition; label: string }[] = [
  { value: 'bottom-right', label: '우하단' },
  { value: 'bottom-left', label: '좌하단' },
  { value: 'top-right', label: '우상단' },
  { value: 'top-left', label: '좌상단' },
]

/**
 * 위젯 라이브 데모(공개) — 실제 <ChangelogWidget> 을 띄워 미읽음 배지·패널·"더 보기"까지 체험.
 * 기본값은 시드 데모 테넌트(pk_demo) — self-hosted 부팅 시 샘플 항목이 채워져 있다.
 */
export default function DemoPage() {
  useDocumentTitle('위젯 데모')
  const { resolved, toggle } = useTheme()

  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    window.location.origin

  const [publishableKey, setPublishableKey] = useState('pk_demo')
  const [endpoint, setEndpoint] = useState(apiBase)
  const [accent, setAccent] = useState('#2f5fe0')
  const [position, setPosition] = useState<WidgetPosition>('bottom-right')
  // key 로 위젯을 재마운트해 설정 변경을 반영.
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
            위젯 라이브 데모
          </h1>
          <p className="mt-2 text-pretty text-text-muted">
            아래 설정으로 실제 임베드 위젯이 이 페이지에 떠 있습니다. 떠 있는{' '}
            <strong className="font-semibold text-text">벨</strong> 버튼(미읽음 배지)을 눌러 최근
            변경 이력을 확인해 보세요. 열면 미읽음이 0이 됩니다.
          </p>
        </div>

        <Card className="mt-8 max-w-2xl">
          <CardHeader>
            <CardTitle>위젯 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="퍼블리시 키 (pk_)"
                htmlFor="demo-pk"
                hint="시드 데모: pk_demo"
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
          게시된 항목이 없으면 패널이 빈 상태로 보입니다. 항목을 작성하려면{' '}
          <Link to="/app" className="font-medium text-accent-strong hover:text-accent">
            대시보드
          </Link>{' '}
          로 이동하세요(로그인 필요).
        </p>
      </main>

      <ChangelogWidget
        key={`${nonce}-${publishableKey}-${endpoint}-${accent}-${position}`}
        publishableKey={publishableKey.trim() || 'pk_demo'}
        endpoint={endpoint.trim() || apiBase}
        accent={accent}
        position={position}
      />
    </div>
  )
}
