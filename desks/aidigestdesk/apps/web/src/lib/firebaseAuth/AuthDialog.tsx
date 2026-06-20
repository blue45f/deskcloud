import { Loader2, LogIn, UserPlus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

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

const inputClass =
  'mt-1.5 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent disabled:opacity-50'

/**
 * Firebase 이메일/비밀번호 + 게스트 로그인 다이얼로그 — 접근성 우선.
 * - 로그인 ⇄ 가입 토글, "게스트로 시작하기"(익명 인증)
 * - 로딩/비활성 상태, aria-live 에러(role="alert")
 * - 포커스: 열릴 때 이메일 입력에 초기 포커스, Tab 트랩, Esc/오버레이로 닫힘
 *
 * 이 앱에는 Radix Dialog 가 없어 토큰(bg·surface·border·ink·accent)만으로 가벼운 모달을
 * 자체 구현했다. 동작/useAuth API/한국어 에러 매핑은 정규 모듈과 동일하다.
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
  const panelRef = useRef<HTMLDivElement>(null)

  const titleId = useId()
  const descId = useId()
  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()

  // 로그인 성공 시 자동으로 닫힌다(prop 콜백 호출 — setState 아님).
  useEffect(() => {
    if (open && user) onOpenChange(false)
  }, [open, user, onOpenChange])

  // 열릴 때 이메일 입력에 초기 포커스(기본 포커스 대신).
  useEffect(() => {
    if (open) {
      const id = window.requestAnimationFrame(() => emailRef.current?.focus())
      return () => window.cancelAnimationFrame(id)
    }
    return undefined
  }, [open])

  if (!open) return null

  /**
   * 닫을 때 폼/에러를 초기화한다 — 다음 열림이 항상 깨끗한 상태로 시작.
   */
  function close() {
    setMode('signin')
    setBusy(null)
    setEmail('')
    setPassword('')
    clearError()
    onOpenChange(false)
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

  // Esc 로 닫고, Tab 은 패널 내부로 가둔다(가벼운 포커스 트랩).
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const copy = COPY[mode]
  const ModeIcon = mode === 'signup' ? UserPlus : LogIn
  const formBusy = busy === 'form'
  const guestBusy = busy === 'guest'
  const anyBusy = busy !== null

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 오버레이 클릭/Esc로 닫는 모달; 포커스는 패널 내부에 트랩.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md border border-accent/30 bg-accent/10 text-accent">
              <ModeIcon className="size-4" aria-hidden />
            </span>
            <h2 id={titleId} className="text-base font-semibold text-text">
              {copy.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-bg text-text-muted transition hover:border-border-strong hover:text-text"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <p id={descId} className="mt-2 text-sm leading-6 text-text-muted">
          {copy.desc}
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
          <label className="block" htmlFor={emailId}>
            <span className="text-xs font-semibold text-text-subtle">이메일</span>
            <input
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
              className={inputClass}
            />
          </label>

          <label className="block" htmlFor={passwordId}>
            <span className="text-xs font-semibold text-text-subtle">비밀번호</span>
            <input
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
              className={inputClass}
            />
          </label>

          {/* 에러는 항상 같은 노드에 두어 aria-live 가 안정적으로 announce 한다. */}
          <div aria-live="assertive">
            {error ? (
              <p
                id={errorId}
                role="alert"
                className="rounded-md border border-accent-4/40 bg-accent-4/10 px-3 py-2 text-[0.8125rem] text-accent-4"
              >
                {error}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-ink bg-ink px-4 text-sm font-semibold text-ink-fg transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
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
          className="mt-2 w-full text-center text-[0.8125rem] font-semibold text-accent transition hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          {copy.toggle}
        </button>

        <div className="my-3 flex items-center gap-3 text-text-subtle">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span className="text-xs">또는</span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>

        <button
          type="button"
          onClick={onGuest}
          disabled={anyBusy}
          aria-busy={guestBusy || undefined}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-bg px-4 text-sm font-semibold text-text-muted transition hover:border-border-strong hover:text-text disabled:pointer-events-none disabled:opacity-50"
        >
          {guestBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          게스트로 시작하기
        </button>
      </div>
    </div>
  )
}
