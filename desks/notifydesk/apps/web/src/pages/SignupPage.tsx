import { type TenantCredentialsDto } from '@notifydesk/shared'
import { ArrowRight, Moon, Rocket, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useSessionStore } from '@/app/sessionStore'
import { useTheme } from '@/app/ThemeContext'
import { CredentialsPanel } from '@/components/feature/CredentialsPanel'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { signup } from '@/services/notifications'

/**
 * 셀프 가입 — name(필수)·slug(선택)·CORS origins(선택). 성공 시 pk_/sk_ 키쌍을 보여 주고
 * secret 키로 세션을 시작한다(이후 대시보드로). secret 평문은 이 화면에서만 1회 노출.
 */
export default function SignupPage() {
  useDocumentTitle('가입')
  const navigate = useNavigate()
  const signIn = useSessionStore((s) => s.signIn)
  const { resolved, toggle } = useTheme()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [corsText, setCorsText] = useState('*')
  const [submitting, setSubmitting] = useState(false)
  const [creds, setCreds] = useState<TenantCredentialsDto | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('서비스/회사 이름을 입력해 주세요.')
      return
    }
    const corsOrigins = corsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)

    setSubmitting(true)
    try {
      const result = await signup({
        name: trimmedName,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(corsOrigins.length > 0 ? { corsOrigins } : {}),
      })
      setCreds(result)
      // secret 키로 세션 시작(+ pk 함께 저장).
      signIn({
        kind: 'secret',
        secretKey: result.secretKey,
        tenantId: result.id,
        publishableKey: result.publishableKey,
      })
      toast.success('테넌트가 생성되었습니다. 키를 안전하게 보관하세요!')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '가입에 실패했습니다.'
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

      <div id="main-content" tabIndex={-1} className="w-full max-w-md outline-none">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link to="/" aria-label="홈으로">
            <Brand />
          </Link>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">
            {creds ? '키가 발급되었습니다' : '테넌트 만들기'}
          </h1>
          <p className="mt-1.5 text-sm text-pretty text-text-muted">
            {creds
              ? 'secret 키는 지금만 볼 수 있습니다. 복사해 안전하게 보관하세요.'
              : '이름만 입력하면 publishable·secret 키쌍을 즉시 발급합니다. 신용카드 불필요.'}
          </p>
        </div>

        <Card>
          <CardContent>
            {creds ? (
              <div className="space-y-5">
                <CredentialsPanel credentials={creds} />
                <Button className="w-full" onClick={() => navigate('/app', { replace: true })}>
                  대시보드로 이동 <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <Field label="서비스/회사 이름" htmlFor="su-name" required>
                  <Input
                    id="su-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: Offhours"
                    autoFocus
                  />
                </Field>
                <Field
                  label="slug (선택)"
                  htmlFor="su-slug"
                  hint="비우면 이름에서 자동 생성. 소문자·숫자·하이픈."
                >
                  <Input
                    id="su-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="offhours"
                    className="font-mono"
                  />
                </Field>
                <Field
                  label="허용 Origin (CORS)"
                  htmlFor="su-cors"
                  hint="publishable 키로 호출 가능한 출처. 쉼표/줄바꿈 구분. 개발은 * 로 시작해도 됩니다."
                >
                  <Input
                    id="su-cors"
                    value={corsText}
                    onChange={(e) => setCorsText(e.target.value)}
                    placeholder="https://app.example.com, *"
                    className="font-mono"
                  />
                </Field>
                <Button type="submit" className="w-full" loading={submitting}>
                  {submitting ? (
                    '생성 중…'
                  ) : (
                    <>
                      <Rocket className="size-4" />
                      가입하고 키 받기
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {!creds ? (
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
