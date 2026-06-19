import { Loader2, LogIn, UserPlus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { Field } from '../../components/Field'
import { Modal } from '../../components/Modal'

import { useAuth } from './useAuth'

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
 * - 포커스: 앱 Modal(Radix Dialog)이 트랩, 열릴 때 이메일 입력으로 초기 포커스 이동
 *
 * 이 앱의 디자인 시스템(Modal·Field·.input·.btn-primary/.btn-ghost·.alert--err 토큰)에
 * 맞춰 적응했다. useAuth API·한국어 에러 매핑은 정본과 동일하게 유지한다.
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

  const titleId = useId()
  const errorId = useId()

  // 로그인 성공 시 자동으로 닫힌다(prop 콜백 호출 — setState 아님).
  useEffect(() => {
    if (open && user) onOpenChange(false)
  }, [open, user, onOpenChange])

  // 열릴 때 이메일 입력으로 초기 포커스를 옮긴다(앱 Modal 은 onOpenAutoFocus 를 노출하지
  // 않으므로, 마운트 직후 한 번 포커스를 잡는다). Radix 가 이후 포커스 트랩을 유지한다.
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => emailRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open])

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

  /**
   * 닫힘 시 폼/에러를 초기화한다 — 다음 열림이 항상 깨끗한 상태로 시작.
   * 앱 Modal 은 onClose 콜백만 주므로 여기서 정리 후 부모에 전파한다.
   */
  function handleClose() {
    setMode('signin')
    setBusy(null)
    setEmail('')
    setPassword('')
    clearError()
    onOpenChange(false)
  }

  const copy = COPY[mode]
  const formBusy = busy === 'form'
  const guestBusy = busy === 'guest'
  const anyBusy = busy !== null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="md"
      title={
        <span id={titleId} className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-accent-soft text-accent">
            {mode === 'signup' ? (
              <UserPlus className="size-4" aria-hidden />
            ) : (
              <LogIn className="size-4" aria-hidden />
            )}
          </span>
          {copy.title}
        </span>
      }
    >
      <p className="mb-4 text-sm text-ink-muted">{copy.desc}</p>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <Field label="이메일">
          <input
            ref={emailRef}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input w-full px-3 py-2 text-sm"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            required
            disabled={anyBusy}
          />
        </Field>

        <Field label="비밀번호">
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            className="input w-full px-3 py-2 text-sm"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            required
            disabled={anyBusy}
          />
        </Field>

        {/* 에러는 항상 같은 노드에 두어 aria-live 가 안정적으로 announce 한다. */}
        <div aria-live="assertive">
          {error ? (
            <p id={errorId} role="alert" className="alert alert--err text-[0.8125rem]">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="btn-primary inline-flex h-10 w-full items-center justify-center gap-1.5 px-4 text-sm"
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
        className="mt-2 w-full text-center text-[0.8125rem] font-medium text-accent transition-colors hover:underline disabled:pointer-events-none disabled:opacity-50"
      >
        {copy.toggle}
      </button>

      <div className="my-3 flex items-center gap-3 text-ink-subtle">
        <span className="h-px flex-1 bg-line" aria-hidden />
        <span className="text-xs">또는</span>
        <span className="h-px flex-1 bg-line" aria-hidden />
      </div>

      <button
        type="button"
        onClick={onGuest}
        disabled={anyBusy}
        aria-busy={guestBusy || undefined}
        className="btn-ghost inline-flex h-10 w-full items-center justify-center gap-1.5 px-4 text-sm"
      >
        {guestBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        게스트로 시작하기
      </button>
    </Modal>
  )
}
