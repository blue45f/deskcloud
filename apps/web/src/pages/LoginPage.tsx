import { ArrowRight, KeyRound, Moon, Rocket, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import type { TenantWithSecretDto } from '@realtimedesk/shared'

import { useAuthStore } from '@/app/authStore'
import { useTheme } from '@/app/ThemeContext'
import { IssuedKeysCard } from '@/components/feature/IssuedKeysCard'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useSignup } from '@/services/tenants'

interface LocationState {
  from?: string
}

/**
 * 외부 온보딩 — 두 갈래:
 *  1) 가입(signup): 이름·(선택)Origin 으로 pk·sk 발급 → 키 확인 후 대시보드로.
 *  2) 로그인: 이미 발급받은 secret 키(sk_) 입력 → 세션 확립.
 */
export default function LoginPage() {
  useDocumentTitle('가입 · 로그인')
  const { resolved, toggle } = useTheme()
  const [tab, setTab] = useState<'signup' | 'login'>('signup')
  const [issued, setIssued] = useState<TenantWithSecretDto | null>(null)

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

      <div id="main-content" tabIndex={-1} className="w-full max-w-md outline-none">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" aria-label="홈으로">
            <Brand />
          </Link>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">
            {issued ? '키가 발급되었습니다' : '실시간을 1분 만에 붙이세요'}
          </h1>
          <p className="mt-1.5 text-sm text-pretty text-text-muted">
            {issued
              ? '아래 키를 저장한 뒤 대시보드로 들어가세요.'
              : '가입하면 publishable·secret 키 한 쌍을 즉시 발급합니다.'}
          </p>
        </div>

        {issued ? (
          <IssuedView tenant={issued} />
        ) : (
          <AuthTabs tab={tab} setTab={setTab} onIssued={setIssued} />
        )}
      </div>
    </div>
  )
}

function AuthTabs({
  tab,
  setTab,
  onIssued,
}: {
  tab: 'signup' | 'login'
  setTab: (t: 'signup' | 'login') => void
  onIssued: (t: TenantWithSecretDto) => void
}) {
  return (
    <Card>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'signup' | 'login')}>
          <TabsList className="mb-5">
            <TabsTrigger value="signup">가입</TabsTrigger>
            <TabsTrigger value="login">로그인 (키 있음)</TabsTrigger>
          </TabsList>
          <TabsContent value="signup">
            <SignupForm onIssued={onIssued} />
          </TabsContent>
          <TabsContent value="login">
            <LoginForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function SignupForm({ onIssued }: { onIssued: (t: TenantWithSecretDto) => void }) {
  const setKeys = useAuthStore((s) => s.setKeys)
  const signup = useSignup()
  const [name, setName] = useState('')
  const [origins, setOrigins] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('프로젝트 이름을 입력해 주세요.')
      return
    }
    const corsOrigins = origins
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)

    signup.mutate(
      { name: trimmed, ...(corsOrigins.length ? { corsOrigins } : {}) },
      {
        onSuccess: (tenant) => {
          // 발급된 sk·pk 로 즉시 세션 확립.
          setKeys(tenant.secretKey, tenant.publishableKey)
          onIssued(tenant)
          toast.success('가입 완료 — 키가 발급되었습니다.')
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : '가입에 실패했습니다.'
          toast.error(msg)
        },
      }
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="프로젝트 이름"
        htmlFor="signup-name"
        required
        hint="대시보드에서 식별용으로 표시됩니다."
      >
        <Input
          id="signup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 우리 협업 보드"
          autoFocus
        />
      </Field>
      <Field
        label="허용 Origin (선택)"
        htmlFor="signup-origins"
        hint="브라우저 구독이 허용될 Origin 목록. 쉼표/줄바꿈 구분. 비우면 모든 Origin(*) 허용(데모)."
      >
        <Input
          id="signup-origins"
          value={origins}
          onChange={(e) => setOrigins(e.target.value)}
          placeholder="https://app.example.com, http://localhost:3000"
        />
      </Field>
      <Button type="submit" className="w-full" loading={signup.isPending}>
        <Rocket className="size-4" />
        가입하고 키 발급
      </Button>
    </form>
  )
}

function LoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const setKeys = useAuthStore((s) => s.setKeys)
  const [value, setValue] = useState('')

  const from = (location.state as LocationState | null)?.from ?? '/app'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const sk = value.trim()
    if (!sk.startsWith('sk_')) {
      toast.error('secret 키(sk_…)를 입력해 주세요.')
      return
    }
    setKeys(sk)
    toast.success('로그인되었습니다.')
    navigate(from, { replace: true })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Secret 키"
        htmlFor="sk"
        hint="가입 시 발급받은 sk_… 를 입력하세요. 이 브라우저에만 저장됩니다(localStorage)."
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
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk_…"
            className="pl-9 font-mono"
          />
        </div>
      </Field>
      <Button type="submit" className="w-full">
        <ShieldCheck className="size-4" />
        로그인
      </Button>
    </form>
  )
}

function IssuedView({ tenant }: { tenant: TenantWithSecretDto }) {
  const navigate = useNavigate()
  return (
    <Card>
      <CardContent className="space-y-5">
        <IssuedKeysCard tenant={tenant} />
        <Button className="w-full" onClick={() => navigate('/app', { replace: true })}>
          대시보드로 이동
          <ArrowRight className="size-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
