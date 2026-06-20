import { SECRET_KEY_PREFIX } from '@changelogdesk/shared'
import { KeyRound, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuthStore } from '@/app/authStore'
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
 * 어드민 로그인 — 테넌트 시크릿 키(sk_…) 또는 글로벌 ADMIN_TOKEN 을 입력한다.
 * sk_ 로 시작하면 시크릿 키 모드(그 테넌트가 대상), 아니면 admin-token 모드
 * (대상 테넌트 id/slug 를 추가로 입력 — 셀프호스트).
 */
export default function LoginPage() {
  useDocumentTitle('로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const { resolved, toggle } = useTheme()
  const [value, setValue] = useState('')
  const [tenantId, setTenantId] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'
  const isTokenMode = value.length > 0 && !value.startsWith(SECRET_KEY_PREFIX)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const credential = value.trim()
    if (!credential) {
      toast.error('시크릿 키 또는 ADMIN_TOKEN 을 입력해 주세요.')
      return
    }
    login(credential, tenantId)
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
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">로그인</h1>
          <p className="mt-1.5 text-sm text-pretty text-text-muted">
            테넌트{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">시크릿 키(sk_)</code>{' '}
            또는 셀프호스트{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">ADMIN_TOKEN</code>{' '}
            을 입력하세요.
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Field
                label="시크릿 키 또는 ADMIN_TOKEN"
                htmlFor="secret-key"
                hint="이 브라우저에만 저장됩니다(localStorage). 공용 PC 에서는 로그아웃하세요."
              >
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
                    aria-hidden
                  />
                  <Input
                    id="secret-key"
                    type="password"
                    autoComplete="current-password"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="sk_… 또는 dev-admin-token-change-me"
                    className="pl-9 font-mono"
                    autoFocus
                  />
                </div>
              </Field>

              {isTokenMode ? (
                <Field
                  label="대상 테넌트 (id 또는 slug)"
                  htmlFor="tenant-id"
                  hint="ADMIN_TOKEN 은 테넌트 비종속이라 대상 테넌트를 지정해야 합니다. 셀프호스트 단일 테넌트면 slug(예: demo)."
                >
                  <Input
                    id="tenant-id"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="demo"
                    className="font-mono"
                  />
                </Field>
              ) : null}

              <Button type="submit" className="w-full">
                <ShieldCheck className="size-4" />
                로그인
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-text-subtle">
          아직 계정이 없나요?{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            셀프서브 가입
          </Link>{' '}
          · 위젯만 보려면{' '}
          <Link to="/demo" className="font-medium text-accent-strong hover:text-accent">
            데모
          </Link>
        </p>
      </div>
    </div>
  )
}
