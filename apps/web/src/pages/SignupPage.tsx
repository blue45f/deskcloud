import { type CreateTenantInput, type TenantCredentialsDto } from '@searchdesk/shared'
import { ArrowRight, Moon, Sparkles, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuthStore } from '@/app/authStore'
import { useTheme } from '@/app/ThemeContext'
import { CredentialsReveal } from '@/components/feature/CredentialsReveal'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useSignup } from '@/services/searchdesk'

/** 셀프 가입(공개) — 이름·CORS·플랜 입력 → pk_/sk_ 발급 → 키 노출 + 자동 로그인. */
export default function SignupPage() {
  useDocumentTitle('가입')
  const navigate = useNavigate()
  const { resolved, toggle } = useTheme()
  const setCreds = useAuthStore((s) => s.setCreds)
  const signup = useSignup()

  const [name, setName] = useState('')
  const [cors, setCors] = useState('*')
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [creds, setCredsState] = useState<TenantCredentialsDto | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('서비스 이름을 입력해 주세요.')
      return
    }
    const corsOrigins = cors
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const input: CreateTenantInput = {
      name: trimmed,
      plan,
      ...(corsOrigins.length > 0 ? { corsOrigins } : {}),
    }

    signup.mutate(input, {
      onSuccess: (c) => {
        setCredsState(c)
        // 발급된 secret 키로 자동 로그인 + publishable/테넌트 id 보관.
        setCreds({
          via: 'secret',
          secretKey: c.secretKey,
          tenantId: c.id,
          publishableKey: c.publishableKey,
        })
        toast.success('가입 완료 — 키가 발급되었습니다.')
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : '가입에 실패했습니다.'
        toast.error(msg)
      },
    })
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

      <div id="main-content" tabIndex={-1} className="w-full max-w-md outline-none">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" aria-label="홈으로">
            <Brand />
          </Link>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">무료로 시작하기</h1>
          <p className="mt-1.5 text-sm text-pretty text-text-muted">
            셀프 가입으로 publishable(pk_)·secret(sk_) 키쌍을 받습니다.
          </p>
        </div>

        {creds ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="size-4 text-accent-strong" aria-hidden />
                  발급된 자격증명
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <CredentialsReveal creds={creds} />
              <Button className="w-full" onClick={() => navigate('/app', { replace: true })}>
                대시보드로 이동 <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <Field
                  label="서비스 이름"
                  htmlFor="su-name"
                  required
                  hint="대시보드·테넌트 식별용."
                >
                  <Input
                    id="su-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: Acme Docs"
                    autoFocus
                  />
                </Field>
                <Field
                  label="CORS 허용 origin"
                  htmlFor="su-cors"
                  hint="검색(pk_)을 호출할 출처. 쉼표로 여러 개. 개발 편의로 기본 * (전체 허용)."
                >
                  <Input
                    id="su-cors"
                    value={cors}
                    onChange={(e) => setCors(e.target.value)}
                    placeholder="* 또는 https://app.example.com"
                    className="font-mono"
                  />
                </Field>
                <Field
                  label="요금제"
                  htmlFor="su-plan"
                  hint="free 는 문서 소프트 캡, pro 는 무제한."
                >
                  <Select
                    id="su-plan"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as 'free' | 'pro')}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                  </Select>
                </Field>
                <Button type="submit" className="w-full" loading={signup.isPending}>
                  가입하고 키 받기
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-text-subtle">
          이미 키가 있나요?{' '}
          <Link to="/login" className="font-medium text-accent-strong hover:text-accent">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
