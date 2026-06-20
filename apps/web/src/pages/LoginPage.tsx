import { isSecretKey } from '@notifydesk/shared'
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
 * 어드민 로그인 — 두 경로.
 *  1) secret 키(sk_)  — 테넌트가 자기 키로. 이후 Authorization: Bearer sk_…
 *  2) ADMIN_TOKEN     — 플랫폼 운영자. X-Admin-Token + 대상 tenantId.
 */
export default function LoginPage() {
  useDocumentTitle('로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const signIn = useSessionStore((s) => s.signIn)
  const { resolved, toggle } = useTheme()

  const [secretKey, setSecretKey] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [tenantId, setTenantId] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'

  const submitSecret = (e: React.FormEvent) => {
    e.preventDefault()
    const key = secretKey.trim()
    if (!key) {
      toast.error('secret 키(sk_)를 입력해 주세요.')
      return
    }
    if (!isSecretKey(key)) {
      toast.error('secret 키는 sk_ 로 시작해야 합니다.')
      return
    }
    signIn({ kind: 'secret', secretKey: key })
    toast.success('로그인되었습니다.')
    navigate(from, { replace: true })
  }

  const submitAdmin = (e: React.FormEvent) => {
    e.preventDefault()
    const token = adminToken.trim()
    const tid = tenantId.trim()
    if (!token) {
      toast.error('ADMIN_TOKEN 을 입력해 주세요.')
      return
    }
    if (!tid) {
      toast.error('대상 테넌트 id(tenantId)를 입력해 주세요.')
      return
    }
    signIn({ kind: 'admin', adminToken: token, tenantId: tid })
    toast.success('플랫폼 어드민으로 로그인되었습니다.')
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
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">대시보드 로그인</h1>
          <p className="mt-1.5 text-sm text-pretty text-text-muted">
            테넌트 secret 키(sk_) 또는 플랫폼 ADMIN_TOKEN 으로 들어갑니다.
          </p>
        </div>

        <Card>
          <CardContent>
            <Tabs defaultValue="secret">
              <TabsList>
                <TabsTrigger value="secret">secret 키</TabsTrigger>
                <TabsTrigger value="admin">ADMIN_TOKEN</TabsTrigger>
              </TabsList>

              <TabsContent value="secret" className="pt-4">
                <form onSubmit={submitSecret} className="space-y-4">
                  <Field
                    label="Secret key (sk_…)"
                    htmlFor="login-sk"
                    hint="가입 시 받은 secret 키. 이 브라우저에만 저장됩니다(localStorage)."
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
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        placeholder="sk_demo"
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

              <TabsContent value="admin" className="pt-4">
                <form onSubmit={submitAdmin} className="space-y-4">
                  <Field label="ADMIN_TOKEN" htmlFor="login-admin">
                    <Input
                      id="login-admin"
                      type="password"
                      autoComplete="off"
                      value={adminToken}
                      onChange={(e) => setAdminToken(e.target.value)}
                      placeholder="dev-admin-token-change-me"
                      className="font-mono"
                    />
                  </Field>
                  <Field
                    label="대상 tenantId"
                    htmlFor="login-tid"
                    hint="ADMIN_TOKEN 경로는 운영할 테넌트 id 가 필요합니다."
                  >
                    <Input
                      id="login-tid"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      placeholder="00000000-0000-…"
                      className="font-mono"
                    />
                  </Field>
                  <Button type="submit" className="w-full">
                    <ShieldCheck className="size-4" />
                    어드민으로 로그인
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-text-subtle">
          아직 테넌트가 없나요?{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            셀프 가입
          </Link>{' '}
          하고 키를 받으세요.
        </p>
      </div>
    </div>
  )
}
