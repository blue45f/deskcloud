import { KeyRound, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAdminStore } from '@/app/adminStore'
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
 * 어드민 로그인 — 계정 대신 단일 ADMIN_TOKEN 입력. 토큰을 클라이언트에 저장하고
 * 이후 모든 어드민 요청에 X-Admin-Token 으로 싣는다.
 */
export default function LoginPage() {
  useDocumentTitle('어드민 로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const setToken = useAdminStore((s) => s.setToken)
  const { resolved, toggle } = useTheme()
  const [value, setValue] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const token = value.trim()
    if (!token) {
      toast.error('어드민 토큰을 입력해 주세요.')
      return
    }
    setToken(token)
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
            서버의{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">ADMIN_TOKEN</code>{' '}
            을 입력하면 집계와 설문 구성에 접근합니다.
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Field
                label="ADMIN_TOKEN"
                htmlFor="admin-token"
                hint="이 브라우저에만 저장됩니다(localStorage). 공용 PC 에서는 로그아웃하세요."
              >
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
                    aria-hidden
                  />
                  <Input
                    id="admin-token"
                    type="password"
                    autoComplete="current-password"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="dev-admin-token-change-me"
                    className="pl-9 font-mono"
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
          토큰이 없나요? 위젯만 체험하려면{' '}
          <Link to="/demo" className="font-medium text-accent-strong hover:text-accent">
            위젯 데모
          </Link>{' '}
          를 보세요.
        </p>
      </div>
    </div>
  )
}
