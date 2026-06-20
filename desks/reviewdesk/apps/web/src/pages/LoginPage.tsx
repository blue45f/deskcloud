import { KeyRound, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { inferKind, useAuthStore } from '@/app/authStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface LocationState {
  from?: string
}

/**
 * 어드민 로그인 — 두 가지 자격을 받는다:
 *   - 테넌트 secret 키(sk_...) → 그 테넌트만 검수
 *   - 글로벌 ADMIN_TOKEN → 셀프호스트 운영자(모든 테넌트, 설정에서 대상 전환)
 * 접두사(sk_)로 종류를 자동 추론한다.
 */
export default function LoginPage() {
  useDocumentTitle('로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const setKey = useAuthStore((s) => s.setKey)
  const { resolved, toggle } = useTheme()
  const [value, setValue] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'
  const detected = value.trim() ? inferKind(value) : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const key = value.trim()
    if (!key) {
      toast.error('secret 키 또는 ADMIN_TOKEN 을 입력해 주세요.')
      return
    }
    setKey(key)
    toast.success('로그인되었습니다.')
    navigate(from, { replace: true })
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="absolute top-4 right-4">
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

      <div id="main-content" tabIndex={-1} className="w-full max-w-sm outline-none">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" aria-label="홈으로">
            <Brand />
          </Link>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">어드민 로그인</h1>
          <p className="mt-1.5 text-sm text-pretty text-text-muted">
            테넌트{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">secret 키</code>{' '}
            또는 서버의{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">ADMIN_TOKEN</code>{' '}
            을 입력하세요.
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Field
                label="secret 키 또는 ADMIN_TOKEN"
                htmlFor="admin-key"
                hint={
                  detected === 'secret'
                    ? 'sk_ 접두사 감지 — 이 테넌트로 로그인합니다.'
                    : detected === 'admin'
                      ? '글로벌 ADMIN_TOKEN 으로 로그인합니다(설정에서 테넌트 전환).'
                      : '이 브라우저에만 저장됩니다(localStorage). 공용 PC 에서는 로그아웃하세요.'
                }
              >
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
                    aria-hidden
                  />
                  <Input
                    id="admin-key"
                    type="password"
                    autoComplete="current-password"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="sk_live_… 또는 dev-admin-token-change-me"
                    className="pl-9 font-mono"
                    autoFocus
                  />
                </div>
              </Field>
              <Button type="submit" className="w-full">
                <ShieldCheck className="size-4" />
                로그인
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-text-subtle">
          아직 테넌트가 없나요?{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            무료로 가입
          </Link>{' '}
          하거나{' '}
          <Link to="/demo" className="font-medium text-accent-strong hover:text-accent">
            위젯 데모
          </Link>{' '}
          를 보세요.
        </p>
      </div>
    </div>
  )
}
