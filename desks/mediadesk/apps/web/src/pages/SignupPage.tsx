import { ArrowRight, Moon, Sparkles, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import type { SignupResultDto } from '@mediadesk/shared'

import { useTheme } from '@/app/ThemeContext'
import { KeyReveal, SecretKeyWarning } from '@/components/feature/KeyReveal'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiEndpoint } from '@/services/api'
import { useSignup } from '@/services/media'
import { reactSnippet, vanillaSnippet } from '@/utils/embed'

export default function SignupPage() {
  useDocumentTitle('가입')
  const navigate = useNavigate()
  const { resolved, toggle } = useTheme()
  const signup = useSignup()
  const [name, setName] = useState('')
  const [corsOrigin, setCorsOrigin] = useState('')
  const [result, setResult] = useState<SignupResultDto | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('워크스페이스 이름을 입력해 주세요.')
      return
    }
    const origins = corsOrigin
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    signup.mutate(
      { name: trimmed, corsOrigins: origins.length ? origins : undefined },
      {
        onSuccess: (res) => {
          setResult(res)
          toast.success('가입 완료! 키를 발급했습니다.')
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : '가입에 실패했습니다.'),
      }
    )
  }

  const endpoint = apiEndpoint()

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
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

      <div id="main-content" tabIndex={-1} className="mx-auto w-full max-w-xl outline-none">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" aria-label="홈으로">
            <Brand />
          </Link>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">워크스페이스 가입</h1>
          <p className="mt-1.5 text-sm text-pretty text-text-muted">
            이름만 정하면 publishable/secret 키를 바로 발급합니다. 카드·이메일 인증 없이 시작하세요.
          </p>
        </div>

        {!result ? (
          <Card>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <Field
                  label="워크스페이스 이름"
                  htmlFor="signup-name"
                  required
                  hint="공개 URL 의 slug 로 자동 변환됩니다(예: Acme Co → acme-co)."
                >
                  <Input
                    id="signup-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: Acme Co"
                    autoFocus
                  />
                </Field>
                <Field
                  label="허용 Origin (선택)"
                  htmlFor="signup-cors"
                  hint="브라우저 업로드를 허용할 도메인. 쉼표로 구분. 비우면 나중에 설정에서 추가하세요."
                >
                  <Input
                    id="signup-cors"
                    value={corsOrigin}
                    onChange={(e) => setCorsOrigin(e.target.value)}
                    placeholder="https://app.example.com, http://localhost:3000"
                    className="font-mono"
                  />
                </Field>
                <Button type="submit" className="w-full" loading={signup.isPending}>
                  <Sparkles className="size-4" />
                  가입하고 키 발급
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            <SecretKeyWarning />
            <Card>
              <CardHeader>
                <CardTitle>발급된 키 — {result.tenant.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <KeyReveal
                  label="Publishable 키 (pk_) · 브라우저 노출 가능"
                  value={result.tenant.publishableKey}
                />
                <KeyReveal
                  label="Secret 키 (sk_) · 서버 전용 · 1회 노출"
                  value={result.secretKey}
                  secret
                />
                <p className="text-xs text-text-subtle">
                  slug: <code className="font-mono text-text">{result.tenant.slug}</code> · 공개
                  자산 경로는{' '}
                  <code className="font-mono text-text">/file/{result.tenant.slug}/…</code>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>바로 임베드</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-text">React</p>
                  <CodeBlock
                    language="tsx"
                    code={reactSnippet({
                      publishableKey: result.tenant.publishableKey,
                      endpoint,
                      folder: 'uploads',
                    })}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-text">스크립트 태그</p>
                  <CodeBlock
                    language="html"
                    code={vanillaSnippet({
                      publishableKey: result.tenant.publishableKey,
                      endpoint,
                      folder: 'uploads',
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => navigate('/app')}>
                대시보드로 이동 <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {!result ? (
          <p className="mt-6 text-center text-xs text-text-subtle">
            이미 키가 있나요?{' '}
            <Link to="/login" className="font-medium text-accent-strong hover:text-accent">
              로그인
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  )
}
