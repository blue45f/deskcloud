import { type CreateTenantInput, type TenantWithKeysDto } from '@changelogdesk/shared'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ArrowRight, Moon, PartyPopper, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuthStore } from '@/app/authStore'
import { useTheme } from '@/app/ThemeContext'
import { KeyField } from '@/components/feature/KeyField'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { signup } from '@/services/changelog'
import { reactSnippet, vanillaSnippet } from '@/utils/embed'

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

/**
 * 외부 셀프서브 온보딩 — 이름(+선택 CORS origin)으로 테넌트를 만들고
 * pk/sk + 임베드 스니펫을 1회 노출한다. secretKey 는 이 화면에서만 볼 수 있다.
 */
export default function SignupPage() {
  useDocumentTitle('가입')
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [name, setName] = useState('')
  const [originsText, setOriginsText] = useState('')
  const [result, setResult] = useState<TenantWithKeysDto | null>(null)

  const endpoint =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : '')

  const mutation = useMutation({
    mutationFn: (input: CreateTenantInput) => signup(input),
    onSuccess: (data) => {
      setResult(data)
      toast.success('워크스페이스가 생성되었습니다. 키를 안전한 곳에 저장하세요.')
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : '가입에 실패했습니다.'
      toast.error(msg)
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('워크스페이스 이름을 입력해 주세요.')
      return
    }
    const corsOrigins = originsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
    mutation.mutate({
      name: name.trim(),
      ...(corsOrigins.length > 0 ? { corsOrigins } : {}),
    })
  }

  const goToDashboard = () => {
    if (!result) return
    // 새 시크릿 키로 즉시 로그인 → 대시보드 진입.
    login(result.secretKey)
    navigate('/app', { replace: true })
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

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-12 outline-none sm:px-6"
      >
        {!result ? (
          <>
            <div className="max-w-xl">
              <h1 className="text-2xl font-semibold tracking-tight text-balance text-text">
                워크스페이스 만들기
              </h1>
              <p className="mt-2 text-pretty text-text-muted">
                이름만 입력하면 바로 시작합니다. 가입하면 브라우저용{' '}
                <strong className="font-semibold text-text">퍼블리시 키(pk_)</strong> 와 서버용{' '}
                <strong className="font-semibold text-text">시크릿 키(sk_)</strong> 를 발급합니다.
                신용카드는 필요 없습니다.
              </p>
            </div>

            <Card className="mt-8 max-w-xl">
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  <Field
                    label="워크스페이스 이름"
                    htmlFor="signup-name"
                    hint="위젯 헤더에 노출됩니다. slug 는 이름에서 자동 생성됩니다."
                    required
                  >
                    <Input
                      id="signup-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: Acme Inc."
                      autoFocus
                      required
                    />
                  </Field>
                  <Field
                    label="허용 Origin (선택)"
                    htmlFor="signup-origins"
                    hint="위젯을 임베드할 사이트의 origin. 줄 또는 쉼표로 구분. 비우면 가입 후 설정에서 추가할 수 있습니다."
                  >
                    <Textarea
                      id="signup-origins"
                      value={originsText}
                      onChange={(e) => setOriginsText(e.target.value)}
                      placeholder={'https://app.example.com\nhttps://www.example.com'}
                      className="min-h-20 font-mono text-[0.8125rem]"
                    />
                  </Field>
                  <Button
                    type="submit"
                    variant="accent"
                    className="w-full"
                    loading={mutation.isPending}
                  >
                    워크스페이스 생성 <ArrowRight className="size-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>

            <p className="mt-6 max-w-xl text-sm text-text-subtle">
              이미 키가 있나요?{' '}
              <Link to="/login" className="font-medium text-accent-strong hover:text-accent">
                로그인
              </Link>
            </p>
          </>
        ) : (
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-success">
              <PartyPopper className="size-5" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight text-text">
                {result.tenant.name} 생성 완료
              </h1>
            </div>
            <p className="mt-2 text-pretty text-text-muted">
              아래 키로 위젯을 임베드하고 변경 이력을 게시하세요. slug 는{' '}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
                {result.tenant.slug}
              </code>{' '}
              입니다.
            </p>

            <div
              className="mt-6 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-text"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p>
                <strong className="font-semibold">시크릿 키는 지금만 표시됩니다.</strong> 안전한
                곳에 복사해 두세요. 분실하면 설정에서 키를 회전(재발급)해야 합니다.
              </p>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>API 키</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="퍼블리시 키 (pk_) — 브라우저·위젯용, 읽기 전용" htmlFor="result-pk">
                  <KeyField value={result.publishableKey} label="퍼블리시 키" />
                </Field>
                <Field label="시크릿 키 (sk_) — 서버·어드민용, 전체 CRUD" htmlFor="result-sk">
                  <KeyField value={result.secretKey} label="시크릿 키" secret />
                </Field>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>임베드 스니펫</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-text">React</p>
                  <CodeBlock
                    code={reactSnippet({ publishableKey: result.publishableKey, endpoint })}
                    language="tsx"
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-text">스크립트 태그(비-React)</p>
                  <CodeBlock
                    code={vanillaSnippet({ publishableKey: result.publishableKey, endpoint })}
                    language="html"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button asChild variant="ghost">
                <Link to="/">
                  <ArrowLeft className="size-4" /> 홈으로
                </Link>
              </Button>
              <Button variant="accent" onClick={goToDashboard}>
                대시보드로 이동 <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
