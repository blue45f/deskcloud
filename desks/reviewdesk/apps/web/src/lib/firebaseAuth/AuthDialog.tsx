import { Loader2, LogIn, UserPlus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { useAuth } from './useAuth'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'

type Mode = 'signin' | 'signup'

const COPY: Record<Mode, { title: string; desc: string; submit: string; toggle: string }> = {
  signin: {
    title: '회원 로그인',
    desc: '이메일과 비밀번호로 로그인하세요. 계정이 없다면 가입하거나 게스트로 시작할 수 있습니다.',
    submit: '로그인',
    toggle: '계정이 없나요? 가입하기',
  },
  signup: {
    title: '회원가입',
    desc: '이메일과 비밀번호로 새 계정을 만드세요. 비밀번호는 6자 이상이어야 합니다.',
    submit: '가입하기',
    toggle: '이미 계정이 있나요? 로그인',
  },
}

/**
 * Firebase 이메일/비밀번호 + 게스트 로그인 다이얼로그 — 접근성 우선.
 * - 로그인 ⇄ 가입 토글, "게스트로 시작하기"(익명 인증)
 * - 로딩/비활성 상태, aria-live 에러(role="alert")
 * - 포커스: Radix Dialog 가 트랩, 열릴 때 이메일 입력에 초기 포커스
 *
 * 디자인 토큰/프리미티브(Dialog·Field·버튼 토큰)에만 의존하므로, 형제 앱으로
 * 벤더링할 때 import 경로만 그 앱 컴포넌트로 맞추면 된다.
 */
export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { signIn, signUp, signInAsGuest, error, clearError, user } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'form' | 'guest' | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()

  // 로그인 성공 시 자동으로 닫힌다(prop 콜백 호출 — setState 아님).
  useEffect(() => {
    if (open && user) onOpenChange(false)
  }, [open, user, onOpenChange])

  /**
   * 닫힘 전이를 가로채 폼/에러를 초기화한다 — 다음 열림이 항상 깨끗한 상태로 시작.
   * (effect 내 동기 setState 를 피하려는 의도. Radix 는 외부 open prop 변경 시
   * onOpenChange 를 호출하지 않으므로, 닫을 때 정리하는 편이 신뢰성 있다.)
   */
  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode('signin')
      setBusy(null)
      setEmail('')
      setPassword('')
      clearError()
    }
    onOpenChange(next)
  }

  function switchMode() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    clearError()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy('form')
    try {
      if (mode === 'signup') await signUp(email, password)
      else await signIn(email, password)
    } catch {
      // 에러는 컨텍스트 state(error)로 노출 — 여기선 무시.
    } finally {
      setBusy(null)
    }
  }

  async function onGuest() {
    if (busy) return
    setBusy('guest')
    try {
      await signInAsGuest()
    } catch {
      // 위와 동일.
    } finally {
      setBusy(null)
    }
  }

  const copy = COPY[mode]
  const formBusy = busy === 'form'
  const guestBusy = busy === 'guest'
  const anyBusy = busy !== null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-sm"
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          // 기본 포커스(닫기 버튼) 대신 이메일 입력으로.
          e.preventDefault()
          emailRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-accent-soft text-accent-fg">
                {mode === 'signup' ? (
                  <UserPlus className="size-4" aria-hidden />
                ) : (
                  <LogIn className="size-4" aria-hidden />
                )}
              </span>
              {copy.title}
            </span>
          </DialogTitle>
          <DialogDescription>{copy.desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3.5">
          <Field label="이메일" htmlFor={emailId} required>
            <Input
              ref={emailRef}
              id={emailId}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              required
              disabled={anyBusy}
            />
          </Field>

          <Field label="비밀번호" htmlFor={passwordId} required>
            <Input
              id={passwordId}
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              required
              disabled={anyBusy}
            />
          </Field>

          {/* 에러는 항상 같은 노드에 두어 aria-live 가 안정적으로 announce 한다. */}
          <div aria-live="assertive">
            {error ? (
              <p
                id={errorId}
                role="alert"
                className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger"
              >
                {error}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-ink px-4 text-sm font-medium text-ink-fg shadow-xs transition-colors hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50"
            disabled={anyBusy || !email || !password}
            aria-busy={formBusy || undefined}
          >
            {formBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {copy.submit}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          disabled={anyBusy}
          className="mt-1 w-full text-center text-[0.8125rem] font-medium text-accent-strong transition-colors hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          {copy.toggle}
        </button>

        <div className="my-1 flex items-center gap-3 text-text-subtle">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span className="text-xs">또는</span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>

        <button
          type="button"
          onClick={onGuest}
          disabled={anyBusy}
          aria-busy={guestBusy || undefined}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text shadow-xs transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50"
        >
          {guestBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          게스트로 시작하기
        </button>
      </DialogContent>
    </Dialog>
  )
}
