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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface LocationState {
  from?: string
}

/**
 * 로그인 — 두 가지 방식(백엔드 SecretKeyGuard 와 동형):
 *  - secret 키(sk_): 테넌트가 자기 키로 로그인.
 *  - 플랫폼 ADMIN_TOKEN(+ 대상 테넌트 id): 운영자가 임의 테넌트를 관리.
 * 입력값은 이 브라우저(localStorage)에만 저장하고 어드민 요청에 헤더로 싣는다.
 */
export default function LoginPage() {
  useDocumentTitle('로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const setCreds = useAuthStore((s) => s.setCreds)
  const { resolved, toggle } = useTheme()

  const [secretKey, setSecretKey] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [tenantId, setTenantId] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'

  const submitSecret = (e: React.FormEvent) => {
    e.preventDefault()
    const key = secretKey.trim()
    if (!key) {
      toast.error('secret 키를 입력해 주세요.')
      return
    }
    if (!key.startsWith('sk_')) {
      toast.error('secret 키는 sk_ 로 시작합니다.')
      return
    }
    setCreds({ via: 'secret', secretKey: key })
    toast.success('로그인되었습니다.')
    navigate(from, { replace: true })
  }

  const submitAdmin = (e: React.FormEvent) => {
    e.preventDefault()
    const token = adminToken.trim()
    const tid = tenantId.trim()
    if (!token || !tid) {
      toast.error('ADMIN_TOKEN 과 대상 테넌트 id 를 모두 입력해 주세요.')
      return
    }
    setCreds({ via: 'admin', adminToken: token, tenantId: tid })
    toast.success('어드민으로 로그인되었습니다.')
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
            테넌트 secret 키 또는 플랫폼 어드민 토큰으로 대시보드에 접근합니다.
          </p>
        </div>

        <Card>
          <CardContent>
            <Tabs defaultValue="secret">
              <TabsList>
                <TabsTrigger value="secret">Secret 키</TabsTrigger>
                <TabsTrigger value="admin">어드민 토큰</TabsTrigger>
              </TabsList>

              <TabsContent value="secret" className="pt-4">
                <form onSubmit={submitSecret} className="space-y-4">
                  <Field
                    label="Secret Key (sk_)"
                    htmlFor="secret-key"
                    hint="가입 시 발급된 sk_ 키. 이 브라우저에만 저장됩니다."
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
                  <Button type="submit" className="w-full">
                    <ShieldCheck className="size-4" />
                    로그인
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="admin" className="pt-4">
                <form onSubmit={submitAdmin} className="space-y-4">
                  <Field
                    label="ADMIN_TOKEN"
                    htmlFor="admin-token"
                    hint="플랫폼 운영자용 마스터 토큰(서버 env)."
                  >
                    <Input
                      id="admin-token"
                      type="password"
                      autoComplete="off"
                      value={adminToken}
                      onChange={(e) => setAdminToken(e.target.value)}
                      placeholder="dev-admin-token-change-me"
                      className="font-mono"
                    />
                  </Field>
                  <Field
                    label="대상 테넌트 id"
                    htmlFor="tenant-id"
                    hint="어드민 토큰 경로는 관리할 테넌트 id 가 필요합니다."
                  >
                    <Input
                      id="tenant-id"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      placeholder="예: 가입 시 받은 테넌트 id"
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
          아직 키가 없나요?{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            무료로 가입
          </Link>{' '}
          하거나{' '}
          <Link to="/demo" className="font-medium text-accent-strong hover:text-accent">
            ⌘K 데모
          </Link>{' '}
          를 보세요.
        </p>
      </div>
    </div>
  )
}
