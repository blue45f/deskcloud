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
 * 어드민 로그인 — 테넌트 secret 키(sk_…)를 입력한다. ChatDesk 어드민 API 는 테넌트
 * 식별을 위해 sk 가 필요하므로(전역 토큰만으로는 어느 테넌트인지 모름) sk 를 1차 자격으로 쓴다.
 * 선택적으로 전역 ADMIN_TOKEN 도 함께 보관할 수 있다. 키는 이 브라우저에만 저장한다.
 */
export default function LoginPage() {
  useDocumentTitle('어드민 로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAdminStore((s) => s.login)
  const { resolved, toggle } = useTheme()
  const [secretKey, setSecretKey] = useState('')
  const [adminToken, setAdminToken] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const sk = secretKey.trim()
    if (!sk) {
      toast.error('secret 키(sk_…)를 입력해 주세요.')
      return
    }
    if (!sk.startsWith('sk_')) {
      toast.error('secret 키는 sk_ 로 시작합니다. publishable 키(pk_)가 아닌 secret 키를 입력하세요.')
      return
    }
    login(sk, adminToken)
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
            테넌트의{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">secret 키(sk_…)</code>
            를 입력하면 대화 모니터·설정에 접근합니다.
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Field
                label="Secret 키 (sk_…)"
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
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="sk_…"
                    className="pl-9 font-mono"
                    autoFocus
                  />
                </div>
              </Field>
              <Field
                label="전역 ADMIN_TOKEN (선택)"
                htmlFor="admin-token"
                hint="셀프호스팅 운영자가 전역 작업에 함께 보낼 토큰입니다. 없으면 비워 두세요."
              >
                <Input
                  id="admin-token"
                  type="password"
                  autoComplete="off"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  placeholder="(선택)"
                  className="font-mono"
                />
              </Field>
              <Button type="submit" className="w-full">
                <ShieldCheck className="size-4" />
                로그인
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-text-subtle">
          아직 키가 없나요?{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            가입하고 키 발급받기
          </Link>
        </p>
      </div>
    </div>
  )
}
