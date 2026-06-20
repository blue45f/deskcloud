import { KeyRound, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAdminStore, type AdminKind } from '@/app/adminStore'
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
 * 어드민 로그인 — 멀티테넌트라 두 가지 자격증명을 지원한다.
 *  - secret 키(sk_...) : 테넌트 본인. 가장 흔한 경로.
 *  - ADMIN_TOKEN       : 셀프호스트 운영자(모든 테넌트). 대상 테넌트 힌트(tenantId/pk_) 선택.
 */
export default function LoginPage() {
  useDocumentTitle('어드민 로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const loginWithSecret = useAdminStore((s) => s.loginWithSecret)
  const loginWithAdminToken = useAdminStore((s) => s.loginWithAdminToken)
  const { resolved, toggle } = useTheme()

  const [sk, setSk] = useState('')
  const [token, setToken] = useState('')
  const [tenantHint, setTenantHint] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'

  const submitSecret = (e: React.FormEvent) => {
    e.preventDefault()
    const v = sk.trim()
    if (!v) {
      toast.error('secret 키를 입력해 주세요.')
      return
    }
    loginWithSecret(v)
    finish('sk')
  }

  const submitToken = (e: React.FormEvent) => {
    e.preventDefault()
    const v = token.trim()
    if (!v) {
      toast.error('ADMIN_TOKEN 을 입력해 주세요.')
      return
    }
    loginWithAdminToken(v, tenantHint)
    finish('adminToken')
  }

  const finish = (_kind: AdminKind) => {
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
            테넌트 <strong className="font-semibold text-text">secret 키</strong> 또는 셀프호스트{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">ADMIN_TOKEN</code>{' '}
            으로 검수·운영에 접근합니다.
          </p>
        </div>

        <Card>
          <CardContent>
            <Tabs defaultValue="secret">
              <TabsList>
                <TabsTrigger value="secret">Secret 키</TabsTrigger>
                <TabsTrigger value="token">ADMIN_TOKEN</TabsTrigger>
              </TabsList>

              <TabsContent value="secret" className="pt-4">
                <form onSubmit={submitSecret} className="space-y-4">
                  <Field
                    label="Secret 키 (sk_...)"
                    htmlFor="sk"
                    hint="이 브라우저에만 저장됩니다(localStorage). 공용 PC 에서는 로그아웃하세요."
                  >
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
                        aria-hidden
                      />
                      <Input
                        id="sk"
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

              <TabsContent value="token" className="pt-4">
                <form onSubmit={submitToken} className="space-y-4">
                  <Field
                    label="ADMIN_TOKEN"
                    htmlFor="admin-token"
                    hint="셀프호스트 운영자용 — 모든 테넌트에 접근합니다."
                  >
                    <Input
                      id="admin-token"
                      type="password"
                      autoComplete="current-password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="dev-admin-token-change-me"
                      className="font-mono"
                    />
                  </Field>
                  <Field
                    label="대상 테넌트 (선택)"
                    htmlFor="tenant-hint"
                    hint="tenantId 또는 publishable 키(pk_...). 비우면 단일 테넌트 환경으로 가정합니다."
                  >
                    <Input
                      id="tenant-hint"
                      value={tenantHint}
                      onChange={(e) => setTenantHint(e.target.value)}
                      placeholder="pk_... 또는 tenant uuid"
                      className="font-mono"
                    />
                  </Field>
                  <Button type="submit" className="w-full">
                    <ShieldCheck className="size-4" />
                    로그인
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-text-subtle">
          아직 키가 없나요?{' '}
          <Link to="/signup" className="font-medium text-accent-strong hover:text-accent">
            셀프 가입
          </Link>{' '}
          ·{' '}
          <Link to="/demo" className="font-medium text-accent-strong hover:text-accent">
            위젯 데모
          </Link>
        </p>
      </div>
    </div>
  )
}
