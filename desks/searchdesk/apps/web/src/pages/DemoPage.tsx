import { SearchBox, SearchPalette } from '@searchdesk/widget'
import { ArrowLeft, Command, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  (typeof window !== 'undefined' ? window.location.origin : '')

/** 공개 ⌘K 데모 — 시드된 데모 테넌트(pk_demo)로 실제 검색까지 체험. */
export default function DemoPage() {
  useDocumentTitle('⌘K 데모')
  const { resolved, toggle } = useTheme()

  const [publishableKey, setPublishableKey] = useState('pk_demo')
  const [endpoint, setEndpoint] = useState(API_BASE)
  const [accent, setAccent] = useState('#2f5fe0')
  const [open, setOpen] = useState(false)
  // key 로 위젯을 재마운트해 설정 변경을 반영.
  const [nonce, setNonce] = useState(0)
  const remount = () => setNonce((n) => n + 1)

  const pk = publishableKey.trim() || 'pk_demo'
  const ep = endpoint.trim() || API_BASE

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
              {resolved === 'dark' ? <Sun className="size-[1.05rem]" /> : <Moon className="size-[1.05rem]" />}
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-12 outline-none sm:px-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-text">
            ⌘K 커맨드 팔레트 라이브 데모
          </h1>
          <p className="mt-2 text-pretty text-text-muted">
            <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">⌘</kbd>{' '}
            <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">K</kbd>{' '}
            (또는 <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">Ctrl</kbd>{' '}
            <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">K</kbd>)를 눌러 팔레트를
            여세요. 아래 인라인 박스에 입력하면 결과가 드롭다운으로 표시됩니다. 시드된 데모 문서가
            검색됩니다 — 예: <em>command palette</em>, <em>ranking</em>, <em>cors</em>, <em>postgres</em>.
          </p>
        </div>

        <Card className="mt-8 max-w-2xl">
          <CardHeader
            action={
              <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
                <Command className="size-4" /> 팔레트 열기
              </Button>
            }
          >
            <CardTitle>위젯 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="publishableKey" htmlFor="demo-pk" hint="시드: pk_demo">
                <Input
                  id="demo-pk"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="endpoint" htmlFor="demo-endpoint">
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
            </div>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={remount}>
                설정 적용(위젯 재마운트)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 max-w-2xl">
          <CardHeader>
            <CardTitle>인라인 SearchBox</CardTitle>
          </CardHeader>
          <CardContent>
            <SearchBox
              key={`box-${nonce}-${pk}-${ep}-${accent}`}
              publishableKey={pk}
              endpoint={ep}
              accent={accent}
              placeholder="문서 검색…"
            />
          </CardContent>
        </Card>

        <p className="mt-6 max-w-2xl text-sm text-text-subtle">
          로컬 API 가 떠 있어야 합니다. PGlite 폴백이면 DB 없이 즉시 부팅됩니다. 내 키로 검색하려면{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            가입
          </Link>{' '}
          하거나{' '}
          <Link to="/login" className="font-medium text-accent-strong hover:text-accent">
            로그인
          </Link>{' '}
          후 임베드 탭을 보세요.
        </p>
      </main>

      {/* 전역 핫키(비제어) + 버튼 제어를 동시에: 제어형으로 두고 핫키는 별도 안내. */}
      <SearchPalette
        key={`palette-${nonce}-${pk}-${ep}-${accent}`}
        publishableKey={pk}
        endpoint={ep}
        accent={accent}
        open={open}
        onClose={() => setOpen(false)}
      />
      {/* 비제어 핫키 팔레트 — ⌘K 로 직접 열림(버튼과 독립). */}
      <SearchPalette
        key={`hotkey-${nonce}-${pk}-${ep}-${accent}`}
        publishableKey={pk}
        endpoint={ep}
        accent={accent}
      />
    </div>
  )
}
