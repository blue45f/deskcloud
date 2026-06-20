import { createTenantSchema, type TenantCreatedDto } from '@reviewdesk/shared'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuthStore } from '@/app/authStore'
import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { CopyButton } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Label } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSignup } from '@/services/tenant'
import { reactSnippet, vanillaSnippet } from '@/utils/embed'

function ThemeBtn() {
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

/** 발급된 키 한 줄 — 라벨 + 모노 값 + 복사 버튼. */
function KeyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label className="mb-0">{label}</Label>
        {hint ? <span className="text-xs text-text-subtle">{hint}</span> : null}
      </div>
      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-text">{value}</code>
        <CopyButton value={value} label={`${label} 복사`} />
      </div>
    </div>
  )
}

export default function SignupPage() {
  useDocumentTitle('가입')
  const navigate = useNavigate()
  const setKey = useAuthStore((s) => s.setKey)
  const signup = useSignup()

  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://reviews.example.com')

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [origins, setOrigins] = useState<string[]>([''])
  const [autoApprove, setAutoApprove] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<TenantCreatedDto | null>(null)

  const setOrigin = (i: number, v: string) =>
    setOrigins((prev) => prev.map((o, idx) => (idx === i ? v : o)))
  const addOrigin = () => setOrigins((prev) => [...prev, ''])
  const removeOrigin = (i: number) =>
    setOrigins((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanedOrigins = origins.map((o) => o.trim()).filter(Boolean)
    const candidate = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      corsOrigins: cleanedOrigins,
      autoApprove,
    }
    const parsed = createTenantSchema.safeParse(candidate)
    if (!parsed.success) {
      const map: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        map[key] = issue.message
      }
      setErrors(map)
      toast.error('입력을 확인해 주세요.')
      return
    }
    setErrors({})
    signup.mutate(parsed.data, {
      onSuccess: (data) => {
        setResult(data)
        toast.success('가입 완료 — 키를 안전한 곳에 보관하세요.')
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : '가입에 실패했습니다.'),
    })
  }

  const loginWithSecret = () => {
    if (!result) return
    setKey(result.secretKey)
    toast.success('secret 키로 로그인했습니다.')
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
            <ThemeBtn />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-12 outline-none sm:px-6"
      >
        {result ? (
          <SignupResult result={result} apiBase={apiBase} onLogin={loginWithSecret} />
        ) : (
          <>
            <div className="max-w-xl">
              <h1 className="text-2xl font-semibold tracking-tight text-balance text-text">
                ReviewDesk 시작하기
              </h1>
              <p className="mt-2 text-pretty text-text-muted">
                서비스 정보를 입력하면 publishable/secret 키와 복사용 임베드 스니펫이 발급됩니다.
                신용카드는 필요 없습니다.
              </p>
            </div>

            <Card className="mt-8">
              <CardHeader>
                <CardTitle>테넌트 만들기</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-5">
                  <Field
                    label="서비스 이름"
                    htmlFor="su-name"
                    required
                    error={errors.name}
                    hint="대시보드·후기에 표시되는 이름입니다."
                  >
                    <Input
                      id="su-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: Acme Inc."
                      autoFocus
                    />
                  </Field>

                  <Field
                    label="slug"
                    htmlFor="su-slug"
                    error={errors.slug}
                    hint="비우면 이름에서 자동 생성됩니다. 소문자·숫자·하이픈."
                  >
                    <Input
                      id="su-slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="acme"
                      className="font-mono"
                    />
                  </Field>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="mb-0">허용 도메인 (CORS)</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={addOrigin}>
                        <Plus className="size-3.5" /> 추가
                      </Button>
                    </div>
                    <p className="mt-1 mb-2 text-xs text-text-subtle">
                      위젯을 띄울 도메인. <code className="font-mono">*</code> 는 전체 허용(개발용).
                      비우면 Origin 없는 호출만 통과합니다.
                    </p>
                    <div className="space-y-2">
                      {origins.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={o}
                            onChange={(e) => setOrigin(i, e.target.value)}
                            placeholder="https://acme.com"
                            className="font-mono"
                            aria-label={`허용 도메인 ${i + 1}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeOrigin(i)}
                            disabled={origins.length === 1}
                            aria-label={`도메인 ${i + 1} 삭제`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {errors.corsOrigins ? (
                      <p role="alert" className="mt-1.5 text-xs text-danger">
                        {errors.corsOrigins}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-start gap-3 rounded-md bg-surface-2 px-3 py-3">
                    <Checkbox
                      id="su-auto"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="su-auto" className="mb-0">
                      자동 승인
                      <span className="mt-0.5 block text-xs font-normal text-text-subtle">
                        켜면 제출 즉시 승인되어 위젯에 바로 노출됩니다(검수 생략). 나중에 설정에서
                        바꿀 수 있습니다.
                      </span>
                    </Label>
                  </div>

                  <Button type="submit" className="w-full" loading={signup.isPending}>
                    가입하고 키 받기
                  </Button>
                </form>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-sm text-text-subtle">
              이미 키가 있나요?{' '}
              <Link to="/login" className="font-medium text-accent-strong hover:text-accent">
                로그인
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  )
}

/* ── 가입 성공 — 키 1회 노출 + 임베드 스니펫 ──────────────────────────────── */

function SignupResult({
  result,
  apiBase,
  onLogin,
}: {
  result: TenantCreatedDto
  apiBase: string
  onLogin: () => void
}) {
  const cfg = {
    publishableKey: result.publishableKey,
    endpoint: apiBase,
    subjectId: 'pro-plan',
    subjectLabel: 'Pro 플랜',
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-success">
          <Check className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            {result.tenant.name} 가입 완료
          </h1>
          <p className="text-sm text-text-muted">
            slug: <code className="font-mono">{result.tenant.slug}</code>
          </p>
        </div>
      </div>

      {/* 키 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>API 키</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <KeyRow
            label="Publishable 키"
            value={result.publishableKey}
            hint="브라우저 안전 · 위젯에 사용"
          />
          <KeyRow label="Secret 키" value={result.secretKey} hint="서버 전용 · 검수/CRUD" />
          <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-[0.8125rem] text-pretty">
              <strong className="font-semibold">Secret 키는 지금만 볼 수 있습니다.</strong> 안전한
              곳에 보관하세요. 분실 시 설정에서 키를 회전(재발급)해야 합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 임베드 스니펫 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>임베드 스니펫</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="react">
            <TabsList>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="script">&lt;script&gt; (바닐라)</TabsTrigger>
            </TabsList>
            <TabsContent value="react" className="pt-4">
              <CodeBlock code={reactSnippet(cfg)} language="tsx" />
            </TabsContent>
            <TabsContent value="script" className="pt-4">
              <CodeBlock code={vanillaSnippet(cfg)} language="html" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary">
          <Link to="/demo">위젯 데모로 확인</Link>
        </Button>
        <Button onClick={onLogin}>
          <ShieldCheck className="size-4" />이 키로 대시보드 열기 <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
