import { loginSchema, type LoginInput } from '@termsdesk/shared'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useAuthConfig, useDemoLogin, useGoogleAuth, useLogin, useSession } from '@/services/auth'
import { zodFormResolver } from '@/utils/zodFormResolver'

export default function LoginPage() {
  useDocumentTitle('로그인')
  const navigate = useNavigate()
  const session = useSession()
  const authConfig = useAuthConfig()
  const login = useLogin()
  const googleAuth = useGoogleAuth()
  const demoLogin = useDemoLogin()
  // 데모 자격증명 자동 채움은 개발 모드에서만 — 운영에선 빈 폼.
  const demo = import.meta.env.DEV
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodFormResolver(loginSchema),
    defaultValues: demo
      ? { email: 'admin@termsdesk.local', password: 'termsdesk-admin' }
      : undefined,
  })

  if (session.data) return <Navigate to="/app" replace />

  const onSubmit = (values: LoginInput) => {
    login.mutate(values, { onSuccess: () => navigate('/app', { replace: true }) })
  }

  const serverError =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? '로그인에 실패했습니다'
        : null

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="grid min-h-screen place-items-center bg-bg px-4 py-10"
    >
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-7 flex justify-center">
          <Brand />
        </Link>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-text">로그인</h1>
          <p className="mt-1 text-sm text-text-muted">약관 버전 관리 콘솔에 접속합니다.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
            <Field label="이메일" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                aria-invalid={errors.email ? true : undefined}
                {...register('email')}
              />
            </Field>
            <Field label="비밀번호" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                {...register('password')}
              />
            </Field>
            {serverError ? (
              <p role="alert" className="text-sm text-danger">
                {serverError}
              </p>
            ) : null}
            <Button type="submit" className="w-full" loading={isSubmitting || login.isPending}>
              로그인
            </Button>
          </form>

          {authConfig.data?.googleEnabled && authConfig.data.googleClientId ? (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-text-subtle">
                <span className="h-px flex-1 bg-border" />
                또는
                <span className="h-px flex-1 bg-border" />
              </div>
              <GoogleSignInButton
                clientId={authConfig.data.googleClientId}
                text="signin_with"
                onCredential={(credential) =>
                  googleAuth.mutate(
                    { credential },
                    { onSuccess: () => navigate('/app', { replace: true }) }
                  )
                }
              />
              {googleAuth.error ? (
                <p role="alert" className="mt-2 text-center text-sm text-danger">
                  {googleAuth.error instanceof ApiError
                    ? googleAuth.error.message
                    : 'Google 로그인에 실패했습니다'}
                </p>
              ) : null}
            </>
          ) : null}

          {authConfig.data?.signupEnabled !== false ? (
            <p className="mt-4 text-center text-sm text-text-muted">
              계정이 없으신가요?{' '}
              <Link to="/register" className="font-medium text-accent-strong hover:underline">
                회원가입
              </Link>
            </p>
          ) : null}
        </div>

        {authConfig.data?.demoEnabled !== false ? (
          <button
            type="button"
            onClick={() => demoLogin.mutate(undefined, { onSuccess: () => navigate('/app') })}
            disabled={demoLogin.isPending}
            className="mt-4 w-full rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-center text-sm font-medium text-text-muted outline-none transition-colors hover:border-accent-strong hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:opacity-60"
          >
            {demoLogin.isPending ? '데모 준비 중…' : '🔎 로그인 없이 둘러보기 (읽기전용 데모)'}
          </button>
        ) : null}

        {demo ? (
          <p className="mt-4 rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-xs text-text-muted">
            개발 데모: 관리자 계정이 미리 채워져 있습니다(self-hosted 첫 부팅 시 시드).
          </p>
        ) : null}
      </div>
    </main>
  )
}
