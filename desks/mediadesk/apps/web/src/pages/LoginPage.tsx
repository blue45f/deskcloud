import { KeyRound, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useSessionStore } from '@/app/sessionStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface LocationState {
  from?: string
}

/**
 * 로그인 — 두 방식: 테넌트 secret 키(sk_) 또는 마스터 ADMIN_TOKEN.
 * 키를 클라이언트에 저장하고 이후 모든 어드민 요청에 헤더로 싣는다.
 */
export default function LoginPage() {
  useDocumentTitle('로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const loginWithSecret = useSessionStore((s) => s.loginWithSecret)
  const loginWithAdminToken = useSessionStore((s) => s.loginWithAdminToken)
  const { resolved, toggle } = useTheme()
  const [sk, setSk] = useState('')
  const [adminToken, setAdminToken] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'

  const submitSecret = (e: React.FormEvent) => {
    e.preventDefault()
    const value = sk.trim()
    if (!value.startsWith('sk_')) {
      toast.error('secret 키(sk_…)를 입력해 주세요.')
      return
    }
    loginWithSecret(value)
    toast.success('로그인되었습니다.')
    navigate(from, { replace: true })
  }

  const submitAdmin = (e: React.FormEvent) => {
    e.preventDefault()
    const value = adminToken.trim()
    if (!value) {
      toast.error('어드민 토큰을 입력해 주세요.')
      return
    }
    loginWithAdminToken(value)
    toast.success('마스터 토큰으로 로그인되었습니다.')
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
          {resolved === 'dark' ? <Sun className="size-[1.05rem]" /> : <Moon className="size-[1.05rem]" />}
        </Button>
      </div>

      <div id="main-content" tabIndex={-1} className="w-full max-w-sm outline-none">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" aria-label="홈으로">
            <Brand />
          </Link>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">로그인</h1>
          <p className="mt-1.5 text-sm text-pretty text-text-muted">
            테넌트 secret 키 또는 마스터 토큰으로 자산을 관리합니다.
          </p>
        </div>

        <Card>
          <CardContent>
            <Tabs defaultValue="secret">
              <TabsList>
                <TabsTrigger value="secret">Secret 키</TabsTrigger>
                <TabsTrigger value="admin">마스터 토큰</TabsTrigger>
              </TabsList>

              <TabsContent value="secret" className="pt-5">
                <form onSubmit={submitSecret} className="space-y-4">
                  <Field
                    label="Secret 키 (sk_…)"
                    htmlFor="login-sk"
                    hint="가입 시 1회 노출된 키입니다. 이 브라우저에만 저장됩니다."
                  >
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
                        aria-hidden
                      />
                      <Input
                        id="login-sk"
                        type="password"
                        autoComplete="off"
                        value={sk}
                        onChange={(e) => setSk(e.target.value)}
                        placeholder="sk_…"
                        className="pl-9 font-mono"
                        autoFocus
                      />
                    </div>
                  </Field>
                  <Button type="submit" className="w-full">
                    <ShieldCheck className="size-4" />
                    secret 키로 로그인
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="admin" className="pt-5">
                <form onSubmit={submitAdmin} className="space-y-4">
                  <Field
                    label="ADMIN_TOKEN (마스터)"
                    htmlFor="login-admin"
                    hint="서버의 마스터 토큰. 모든 테넌트를 관리할 수 있습니다."
                  >
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
                        aria-hidden
                      />
                      <Input
                        id="login-admin"
                        type="password"
                        autoComplete="current-password"
                        value={adminToken}
                        onChange={(e) => setAdminToken(e.target.value)}
                        placeholder="dev-admin-token-change-me"
                        className="pl-9 font-mono"
                      />
                    </div>
                  </Field>
                  <Button type="submit" className="w-full">
                    <ShieldCheck className="size-4" />
                    마스터 토큰으로 로그인
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-text-subtle">
          아직 계정이 없나요?{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            가입하고 키 발급받기
          </Link>
        </p>
      </div>
    </div>
  )
}
