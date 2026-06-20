import { ArrowRight, Check, KeyRound, Moon, ShieldAlert, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import type { Plan, TenantWithSecretDto } from '@chatdesk/shared'

import { useAdminStore } from '@/app/adminStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { CopyButton } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { publicEndpoint } from '@/services/api'
import { useSignup } from '@/services/chat'
import { reactSnippet, serverSnippet, vanillaSnippet } from '@/utils/embed'

function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      onClick={toggle}
      aria-label={resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {resolved === 'dark' ? <Sun className="size-[1.05rem]" /> : <Moon className="size-[1.05rem]" />}
    </Button>
  )
}

/** 가입 결과 — pk·sk 키 + 임베드 스니펫. sk 평문은 이 화면에서만 노출된다. */
function Result({ tenant }: { tenant: TenantWithSecretDto }) {
  const navigate = useNavigate()
  const login = useAdminStore((s) => s.login)
  const endpoint = publicEndpoint()
  const cfg = { publishableKey: tenant.publishableKey, endpoint }

  const goDashboard = () => {
    login(tenant.secretKey)
    navigate('/app', { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-warning/40 bg-warning-soft p-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="text-[0.8125rem] text-text">
            <p className="font-semibold">secret 키는 지금만 보입니다</p>
            <p className="mt-0.5 text-text-muted">
              아래 secret 키(sk_…)는 이 화면에서만 평문으로 표시됩니다. 안전한 곳(서버 환경변수)에
              보관하세요. 분실 시 설정에서 키를 회전해야 합니다.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tenant.name} — 발급된 키</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[0.8125rem] font-medium text-text">
              <KeyRound className="size-3.5 text-text-subtle" aria-hidden />
              Publishable 키 (브라우저)
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
                {tenant.publishableKey}
              </code>
              <CopyButton value={tenant.publishableKey} label="publishable 키 복사" />
            </div>
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[0.8125rem] font-medium text-text">
              <KeyRound className="size-3.5 text-danger" aria-hidden />
              Secret 키 (서버 전용)
            </p>
            <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
                {tenant.secretKey}
              </code>
              <CopyButton value={tenant.secretKey} label="secret 키 복사" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
            <Badge tone="neutral" size="sm">
              plan: {tenant.plan}
            </Badge>
            <Badge tone="neutral" size="sm">
              CORS: {tenant.corsOrigins.join(', ') || '없음'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>바로 붙이기 — 임베드 스니펫</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-text">React 앱</p>
            <CodeBlock code={reactSnippet(cfg)} language="tsx" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-text">스크립트 태그(비-React)</p>
            <CodeBlock code={vanillaSnippet(cfg)} language="html" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-text">서버(호스트 백엔드, secret 키)</p>
            <CodeBlock code={serverSnippet({ endpoint })} language="ts" />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={goDashboard}>
          <Check className="size-4" />
          이 키로 대시보드 들어가기
        </Button>
        <Button asChild variant="secondary">
          <Link to="/login">나중에 로그인</Link>
        </Button>
      </div>
    </div>
  )
}

export default function SignupPage() {
  useDocumentTitle('가입')
  const signup = useSignup()
  const [name, setName] = useState('')
  const [plan, setPlan] = useState<Plan>('free')
  const [corsOrigins, setCorsOrigins] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('테넌트 이름을 입력해 주세요.')
      return
    }
    const origins = corsOrigins
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
    signup.mutate(
      {
        name: trimmed,
        plan,
        ...(origins.length > 0 ? { corsOrigins: origins } : {}),
      },
      {
        onSuccess: () => toast.success('가입 완료 — 키가 발급되었습니다.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : '가입에 실패했습니다.'),
      }
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="홈으로">
            <Brand />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">로그인</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 outline-none sm:px-6">
        {signup.data ? (
          <Result tenant={signup.data} />
        ) : (
          <div className="mx-auto max-w-lg">
            <div className="mb-6 text-center">
              <Badge tone="accent" size="sm">
                셀프서브 가입
              </Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-text">
                테넌트를 만들고 키를 발급받으세요
              </h1>
              <p className="mt-2 text-pretty text-text-muted">
                가입하면 publishable(pk_)·secret(sk_) 키 한 쌍이 발급됩니다. 브라우저는 pk 로,
                서버는 sk 로 메시징을 붙입니다.
              </p>
            </div>

            <Card>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  <Field
                    label="테넌트 이름"
                    htmlFor="tenant-name"
                    required
                    hint="대시보드·청구에 표시되는 이름입니다."
                  >
                    <Input
                      id="tenant-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: Offhours"
                      autoFocus
                    />
                  </Field>
                  <Field label="요금제" htmlFor="tenant-plan">
                    <Select
                      id="tenant-plan"
                      value={plan}
                      onChange={(e) => setPlan(e.target.value as Plan)}
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                    </Select>
                  </Field>
                  <Field
                    label="허용 Origin (선택)"
                    htmlFor="tenant-cors"
                    hint="브라우저 위젯을 띄울 도메인. 쉼표·줄바꿈으로 구분. 비우면 모든 Origin(* — 데모용)을 허용합니다."
                  >
                    <Input
                      id="tenant-cors"
                      value={corsOrigins}
                      onChange={(e) => setCorsOrigins(e.target.value)}
                      placeholder="https://app.example.com, https://staging.example.com"
                      className="font-mono"
                    />
                  </Field>
                  <Button type="submit" className="w-full" loading={signup.isPending}>
                    가입하고 키 발급 <ArrowRight className="size-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-xs text-text-subtle">
              이미 키가 있나요?{' '}
              <Link to="/login" className="font-medium text-accent-strong hover:text-accent">
                로그인
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
