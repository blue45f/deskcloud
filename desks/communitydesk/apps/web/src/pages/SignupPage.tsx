import { AlertTriangle, ArrowRight, Check, Moon, Plus, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import type { TenantCreatedDto } from '@communitydesk/shared'

import { useAdminStore } from '@/app/adminStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { CopyButton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError, API_BASE } from '@/services/api'
import { registerTenant } from '@/services/community'
import { reactSnippet, vanillaSnippet } from '@/utils/embed'

function endpointForSnippet(): string {
  // 위젯이 붙을 공개 API 베이스. 빌드 타임 주입이 없으면 현재 origin.
  return API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
}

/** 가입 완료 — 키·스니펫 노출 단계. secret 키는 여기서만 평문으로 보인다. */
function CreatedView({ result }: { result: TenantCreatedDto }) {
  const navigate = useNavigate()
  const loginWithSecret = useAdminStore((s) => s.loginWithSecret)
  const endpoint = endpointForSnippet()
  const boardSlug = 'general'

  const goToDashboard = () => {
    loginWithSecret(result.secretKey)
    toast.success('secret 키로 로그인합니다.')
    navigate('/app', { replace: true })
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <Check className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-text">
          {result.tenant.name} 테넌트가 생성되었습니다
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">
          키를 안전하게 보관하세요. secret 키는 <strong className="text-text">지금 한 번만</strong>{' '}
          표시됩니다.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
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
                위젯에 그대로 넣습니다 — 읽기 + 멤버 글/댓글/반응 작성.
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[0.8125rem] font-medium text-text">Secret 키</span>
                <Badge tone="danger" size="sm">
                  서버 전용 · 1회 노출
                </Badge>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger-soft/40 px-3 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-text">
                  {result.secretKey}
                </code>
                <CopyButton value={result.secretKey} label="secret 키 복사" />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-danger">
                <AlertTriangle className="size-3.5 shrink-0" />
                서버 환경변수에만 보관하세요. 브라우저에 노출하면 안 됩니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-text">React 임베드</h2>
          <CodeBlock
            code={reactSnippet({ publishableKey: result.publishableKey, endpoint, boardSlug })}
            language="tsx"
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-text">바닐라(스크립트) 임베드</h2>
          <CodeBlock
            code={vanillaSnippet({ publishableKey: result.publishableKey, endpoint, boardSlug })}
            language="html"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button asChild variant="ghost">
            <Link to="/">홈으로</Link>
          </Button>
          <Button onClick={goToDashboard}>
            대시보드로 이동 <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  useDocumentTitle('셀프 가입')
  const { resolved, toggle } = useTheme()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [origins, setOrigins] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<TenantCreatedDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setOrigin = (i: number, v: string) =>
    setOrigins((prev) => prev.map((o, idx) => (idx === i ? v : o)))
  const addOrigin = () => setOrigins((prev) => [...prev, ''])
  const removeOrigin = (i: number) =>
    setOrigins((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('서비스 이름을 입력해 주세요.')
      return
    }
    const corsOrigins = origins.map((o) => o.trim()).filter(Boolean)
    setSubmitting(true)
    setError(null)
    try {
      const created = await registerTenant({
        name: name.trim(),
        slug: slug.trim() || undefined,
        corsOrigins,
      })
      setResult(created)
      toast.success('테넌트가 생성되었습니다.')
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : '가입에 실패했습니다.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
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

      <div id="main-content" tabIndex={-1} className="w-full outline-none">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
          {result ? (
            <CreatedView result={result} />
          ) : (
            <div className="w-full max-w-md">
              <div className="mb-6 flex flex-col items-center text-center">
                <Link to="/" aria-label="홈으로">
                  <Brand />
                </Link>
                <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">셀프 가입</h1>
                <p className="mt-1.5 text-sm text-pretty text-text-muted">
                  서비스를 등록하면 publishable·secret 키와 임베드 스니펫을 즉시 발급합니다.
                </p>
              </div>

              <Card>
                <CardContent>
                  <form onSubmit={submit} className="space-y-4">
                    <Field label="서비스 이름" htmlFor="name" required>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="예: Acme 커뮤니티"
                        autoFocus
                      />
                    </Field>
                    <Field
                      label="slug (선택)"
                      htmlFor="slug"
                      hint="비우면 이름에서 자동 생성합니다. 소문자·숫자·하이픈."
                    >
                      <Input
                        id="slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="acme-community"
                        className="font-mono"
                      />
                    </Field>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[0.8125rem] font-medium text-text">
                          허용 Origin (CORS)
                        </span>
                        <Button type="button" variant="ghost" size="sm" onClick={addOrigin}>
                          <Plus className="size-3.5" /> 추가
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {origins.map((o, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input
                              value={o}
                              onChange={(e) => setOrigin(i, e.target.value)}
                              placeholder="https://app.example.com  (또는 *)"
                              className="font-mono"
                              aria-label={`허용 origin ${i + 1}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeOrigin(i)}
                              disabled={origins.length === 1}
                              aria-label="이 origin 제거"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs text-text-subtle">
                        위젯이 호출할 사이트의 origin 입니다. <code className="font-mono">*</code> 는
                        전체 허용(개발/데모용). 나중에 설정에서 바꿀 수 있습니다.
                      </p>
                    </div>

                    {error ? (
                      <p role="alert" className="text-xs text-danger">
                        {error}
                      </p>
                    ) : null}

                    <Button type="submit" className="w-full" loading={submitting}>
                      가입하고 키 받기
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
    </div>
  )
}
