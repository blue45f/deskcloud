import { registerSchema, type RegisterInput } from '@termsdesk/shared'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useAuthConfig, useGoogleAuth, useRegister, useSession } from '@/services/auth'
import { zodFormResolver } from '@/utils/zodFormResolver'

export default function RegisterPage() {
  useDocumentTitle('회원가입')
  const navigate = useNavigate()
  const session = useSession()
  const authConfig = useAuthConfig()
  const signup = useRegister()
  const googleAuth = useGoogleAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodFormResolver(registerSchema) })

  if (session.data) return <Navigate to="/app" replace />
  // 가입이 비활성화된 서버면 로그인으로
  if (authConfig.data && !authConfig.data.signupEnabled) return <Navigate to="/login" replace />

  const onSubmit = (values: RegisterInput) => {
    signup.mutate(values, { onSuccess: () => navigate('/app', { replace: true }) })
  }

  const serverError =
    signup.error instanceof ApiError
      ? signup.error.message
      : signup.error
        ? '회원가입에 실패했습니다'
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
          <h1 className="text-lg font-semibold text-text">회원가입</h1>
          <p className="mt-1 text-sm text-text-muted">조직을 만들고 약관 버전 관리를 시작합니다.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
            <Field label="조직(회사)명" htmlFor="orgName" error={errors.orgName?.message}>
              <Input
                id="orgName"
                autoComplete="organization"
                placeholder="우리 회사"
                aria-invalid={errors.orgName ? true : undefined}
                {...register('orgName')}
              />
            </Field>
            <Field label="이름" htmlFor="name" error={errors.name?.message}>
              <Input
                id="name"
                autoComplete="name"
                aria-invalid={errors.name ? true : undefined}
                {...register('name')}
              />
            </Field>
            <Field label="이메일" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={errors.email ? true : undefined}
                {...register('email')}
              />
            </Field>
            <Field
              label="비밀번호"
              htmlFor="password"
              error={errors.password?.message}
              hint="8자 이상"
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={errors.password ? true : undefined}
                {...register('password')}
              />
            </Field>
            {serverError ? (
              <p role="alert" className="text-sm text-danger">
                {serverError}
              </p>
            ) : null}
            <Button type="submit" className="w-full" loading={isSubmitting || signup.isPending}>
              가입하고 시작하기
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
                text="signup_with"
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

          <p className="mt-4 text-center text-sm text-text-muted">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-medium text-accent-strong hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
