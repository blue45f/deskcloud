import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useSessionStore } from '@/app/sessionStore'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { ApiError, fetchTenant } from '@/services/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface LocationState {
  from?: string
}

export default function LoginPage() {
  useDocumentTitle('로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const setToken = useSessionStore((s) => s.setToken)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as LocationState | null)?.from ?? '/dashboard'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const token = value.trim()
    if (!token) return
    setBusy(true)
    setError(null)
    // 토큰을 임시로 세팅하고 /tenant 로 검증한다. 실패하면 정리.
    setToken(token)
    try {
      await fetchTenant()
      navigate(from, { replace: true })
    } catch (err) {
      useSessionStore.getState().clear()
      const msg =
        err instanceof ApiError
          ? err.status === 401 || err.status === 403
            ? '키가 올바르지 않습니다. secret 키(sk_…)를 다시 확인하세요.'
            : err.message
          : '로그인에 실패했습니다. 잠시 후 다시 시도하세요.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-20">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent-fg">
          <LogIn className="size-4.5" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-text">콘솔 로그인</h1>
      </div>
      <p className="mt-2 text-sm text-text-muted">
        테넌트의 <strong className="text-text">secret 키(sk_…)</strong> 를 입력하세요. 가입 응답이나
        키 회전 시 받은 평문을 사용합니다. 키는 이 브라우저에만 저장됩니다.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field
          label="Secret 키 (또는 ADMIN_TOKEN)"
          htmlFor="login-token"
          hint="Authorization: Bearer 로 전송됩니다. 서버 전용 시크릿이니 공용 PC 에서는 입력을 피하세요."
        >
          <Input
            id="login-token"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk_…"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </Field>

        {error ? <Banner tone="error">{error}</Banner> : null}

        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!value.trim()}>
          로그인
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-text-muted">
        아직 테넌트가 없나요?{' '}
        <Link to="/signup" className="font-medium text-accent-strong hover:underline">
          무료로 가입
        </Link>
      </p>
    </div>
  )
}
