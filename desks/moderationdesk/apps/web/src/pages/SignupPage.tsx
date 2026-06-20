import { ArrowRight, KeyRound, Moon, ShieldAlert, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import type { TenantCreatedDto } from '@moderationdesk/shared'

import { useAuthStore } from '@/app/authStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { CopyButton } from '@/components/ui/feedback'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useSignup } from '@/services/moderation'
import { reactReportSnippet, serverSnippet } from '@/utils/embed'

function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
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
  )
}

/** 발급된 키를 보여주는 영수증 화면 — secret 키는 여기서만 평문 노출된다. */
function Issued({ result }: { result: TenantCreatedDto }) {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const endpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    window.location.origin

  const goDashboard = () => {
    login({ kind: 'sk', secret: result.secretKey })
    toast.success('secret 키로 로그인되었습니다.')
    navigate('/app', { replace: true })
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <ShieldAlert className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-text">
          테넌트가 생성되었습니다
        </h1>
        <p className="mt-1.5 text-sm text-pretty text-text-muted">
          아래 <strong className="font-semibold text-text">secret 키</strong> 는{' '}
          <strong className="font-semibold text-text">지금 단 한 번만</strong> 표시됩니다. 안전한
          곳에 저장하세요. 잃어버리면 설정에서 키를 회전해야 합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>발급된 키</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[0.8125rem] font-medium text-text">Publishable 키</span>
              <Badge tone="info" size="sm">
                브라우저 안전
              </Badge>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-text">
                {result.publishableKey}
              </code>
              <CopyButton value={result.publishableKey} label="publishable 키 복사" />
            </div>
            <p className="mt-1.5 text-xs text-text-subtle">
              위젯(신고 버튼·사전검사)에서 사용합니다. 공개되어도 안전합니다.
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[0.8125rem] font-medium text-text">Secret 키</span>
              <Badge tone="danger" size="sm">
                1회 노출 · 서버 전용
              </Badge>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger-soft/50 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-text">
                {result.secretKey}
              </code>
              <CopyButton value={result.secretKey} label="secret 키 복사" />
            </div>
            <p className="mt-1.5 text-xs text-text-subtle">
              서버에서 차단 결정·규칙/신고/로그 관리에 사용합니다. 절대 브라우저로 내려보내지
              마세요.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-text">React — 신고 버튼(publishable)</p>
          <CodeBlock
            code={reactReportSnippet({ publishableKey: result.publishableKey, endpoint })}
            language="tsx"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-text">서버 — 콘텐츠 게이트(secret)</p>
          <CodeBlock code={serverSnippet({ endpoint })} language="ts" />
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse items-center justify-end gap-2 sm:flex-row">
        <Button asChild variant="ghost">
          <Link to="/">홈으로</Link>
        </Button>
        <Button onClick={goDashboard}>
          이 키로 대시보드 열기 <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/** 테넌트 셀프 가입 — 이름·CORS 오리진을 받아 키를 발급한다. */
export default function SignupPage() {
  useDocumentTitle('무료로 시작')
  const signup = useSignup()
  const [name, setName] = useState('')
  const [origins, setOrigins] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TenantCreatedDto | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('서비스 이름을 입력해 주세요.')
      return
    }
    setError(null)
    const corsOrigins = origins
      .split(/[\n,]/)
      .map((o) => o.trim())
      .filter(Boolean)

    signup.mutate(
      { name: trimmed, corsOrigins },
      {
        onSuccess: (data) => {
          setResult(data)
          toast.success('테넌트가 생성되었습니다. secret 키를 저장하세요.')
        },
        onError: (err) => {
          setError(err instanceof ApiError ? err.message : '가입에 실패했습니다.')
        },
      }
    )
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div id="main-content" tabIndex={-1} className="flex w-full justify-center outline-none">
        {result ? (
          <Issued result={result} />
        ) : (
          <div className="w-full max-w-md">
            <div className="mb-6 flex flex-col items-center text-center">
              <Link to="/" aria-label="홈으로">
                <Brand />
              </Link>
              <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">
                무료로 시작하기
              </h1>
              <p className="mt-1.5 text-sm text-pretty text-text-muted">
                서비스를 등록하면 publishable · secret 키를 즉시 발급합니다. 카드 없이 시작하세요.
              </p>
            </div>

            <Card>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  <Field
                    label="서비스 이름"
                    htmlFor="signup-name"
                    required
                    error={error ?? undefined}
                    hint="대시보드와 slug 생성에 쓰입니다. 예: Acme Community"
                  >
                    <Input
                      id="signup-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: Acme Community"
                      autoFocus
                    />
                  </Field>
                  <Field
                    label="허용 Origin (선택)"
                    htmlFor="signup-origins"
                    hint="브라우저 위젯이 호출할 사이트의 origin. 줄바꿈/쉼표로 여러 개. 비우면 나중에 설정에서 추가. '*' = 전체 허용."
                  >
                    <Textarea
                      id="signup-origins"
                      value={origins}
                      onChange={(e) => setOrigins(e.target.value)}
                      placeholder={'https://app.example.com\nhttps://www.example.com'}
                      className="min-h-20 font-mono text-[0.8125rem]"
                    />
                  </Field>
                  <Button type="submit" className="w-full" loading={signup.isPending}>
                    <KeyRound className="size-4" />키 발급받기
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
      </div>
    </div>
  )
}
