import { KeyRound, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuthStore, type CredentialKind } from '@/app/authStore'
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
 * 어드민 로그인 — 두 가지 자격증명을 지원한다.
 *   - 테넌트 secret 키(sk_…) : SaaS 고객. 자기 테넌트만.
 *   - 글로벌 ADMIN_TOKEN      : 셀프호스트 운영자. 대상 테넌트의 publishable 키를 함께 지정.
 */
export default function LoginPage() {
  useDocumentTitle('로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const { resolved, toggle } = useTheme()

  const [sk, setSk] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [tenantPk, setTenantPk] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'

  const doLogin = (kind: CredentialKind) => {
    if (kind === 'sk') {
      const secret = sk.trim()
      if (!secret) {
        toast.error('secret 키를 입력해 주세요.')
        return
      }
      login({ kind: 'sk', secret })
    } else {
      const secret = adminToken.trim()
      if (!secret) {
        toast.error('ADMIN_TOKEN 을 입력해 주세요.')
        return
      }
      const pk = tenantPk.trim()
      if (!pk) {
        toast.error('대상 테넌트의 publishable 키(pk_…)를 입력해 주세요.')
        return
      }
      login({ kind: 'admin', secret, tenantPk: pk })
    }
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
            테넌트 secret 키 또는 글로벌 ADMIN_TOKEN 으로 관리 콘솔에 들어갑니다.
          </p>
        </div>

        <Card>
          <CardContent>
            <Tabs defaultValue="sk">
              <TabsList>
                <TabsTrigger value="sk">테넌트 키(sk)</TabsTrigger>
                <TabsTrigger value="admin">운영자(ADMIN_TOKEN)</TabsTrigger>
              </TabsList>

              <TabsContent value="sk" className="pt-5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    doLogin('sk')
                  }}
                  className="space-y-4"
                >
                  <Field
                    label="Secret 키"
                    htmlFor="login-sk"
                    hint="가입 시 발급받은 sk_… 키. 데모: sk_demo. 이 브라우저에만 저장됩니다."
                  >
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
                        aria-hidden
                      />
                      <Input
                        id="login-sk"
                        type="password"
                        autoComplete="current-password"
                        value={sk}
                        onChange={(e) => setSk(e.target.value)}
                        placeholder="sk_..."
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
              </TabsContent>

              <TabsContent value="admin" className="pt-5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    doLogin('admin')
                  }}
                  className="space-y-4"
                >
                  <Field
                    label="ADMIN_TOKEN"
                    htmlFor="login-admin"
                    hint="서버의 글로벌 ADMIN_TOKEN — 모든 테넌트에 접근합니다(셀프호스트 운영자)."
                  >
                    <Input
                      id="login-admin"
                      type="password"
                      autoComplete="current-password"
                      value={adminToken}
                      onChange={(e) => setAdminToken(e.target.value)}
                      placeholder="dev-admin-token-change-me"
                      className="font-mono"
                    />
                  </Field>
                  <Field
                    label="대상 테넌트 publishable 키"
                    htmlFor="login-pk"
                    hint="관리할 테넌트의 pk_… 키. 데모: pk_demo. 설정에서 언제든 전환할 수 있습니다."
                  >
                    <Input
                      id="login-pk"
                      value={tenantPk}
                      onChange={(e) => setTenantPk(e.target.value)}
                      placeholder="pk_..."
                      className="font-mono"
                    />
                  </Field>
                  <Button type="submit" className="w-full">
                    <ShieldCheck className="size-4" />
                    운영자로 로그인
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-text-subtle">
          키가 없나요?{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            무료로 시작
          </Link>{' '}
          하거나{' '}
          <Link to="/demo" className="font-medium text-accent-strong hover:text-accent">
            위젯 데모
          </Link>
          를 보세요.
        </p>
      </div>
    </div>
  )
}
