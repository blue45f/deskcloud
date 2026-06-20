import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react'

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
 * - 로딩/비활성 상태, aria-live 에러
 * - 포커스: 열릴 때 이메일 입력에 초기 포커스, Escape/백드롭 클릭으로 닫힘
 *
 * 이 앱은 Radix/Tailwind 없이 자체 `ad-*` CSS 토큰을 쓴다 — 네이티브 오버레이 +
 * role="dialog" 로 모달을 구성한다. useAuth API·한국어 에러 매핑은 표준본과 동일하다.
 */
export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): ReactElement | null {
  const { signIn, signUp, signInAsGuest, error, clearError, user } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'form' | 'guest' | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()
  const titleId = useId()
  const descId = useId()

  // 로그인 성공 시 자동으로 닫힌다.
  useEffect(() => {
    if (open && user) onOpenChange(false)
  }, [open, user, onOpenChange])

  // 열릴 때 이메일 입력에 초기 포커스.
  useEffect(() => {
    if (open) emailRef.current?.focus()
  }, [open])

  /** 폼/에러를 초기화하고 닫는다 — 다음 열림이 항상 깨끗한 상태로 시작. */
  const close = useCallback(() => {
    setMode('signin')
    setBusy(null)
    setEmail('')
    setPassword('')
    clearError()
    onOpenChange(false)
  }, [clearError, onOpenChange])

  // Escape 로 닫기 — 모달이 열려 있을 때만 구독.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

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

  if (!open) return null

  const copy = COPY[mode]
  const formBusy = busy === 'form'
  const guestBusy = busy === 'guest'
  const anyBusy = busy !== null

  return (
    <div
      className="ad-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        // 백드롭(오버레이 자체)을 직접 눌렀을 때만 닫는다 — 모달 내부 클릭은 무시.
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="ad-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="ad-modal-head">
          <span className="ad-modal-icon" aria-hidden="true">
            {mode === 'signup' ? '＋' : '→'}
          </span>
          <h2 id={titleId} className="ad-modal-title">
            {copy.title}
          </h2>
        </div>
        <p id={descId} className="ad-modal-desc">
          {copy.desc}
        </p>

        <form onSubmit={onSubmit}>
          <label className="ad-field" htmlFor={emailId}>
            <span className="ad-label">이메일</span>
            <input
              ref={emailRef}
              id={emailId}
              className="ad-input"
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
          </label>

          <label className="ad-field" htmlFor={passwordId}>
            <span className="ad-label">비밀번호</span>
            <input
              id={passwordId}
              className="ad-input"
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
          </label>

          {/* 에러는 항상 같은 노드에 두어 aria-live 가 안정적으로 announce 한다. */}
          <div aria-live="assertive">
            {error ? (
              <div id={errorId} className="ad-alert ad-alert-error" role="alert">
                {error}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            className="ad-btn ad-btn-primary ad-btn-block"
            disabled={anyBusy || !email || !password}
            aria-busy={formBusy || undefined}
          >
            {formBusy ? '처리 중…' : copy.submit}
          </button>
        </form>

        <button type="button" className="ad-modal-toggle" onClick={switchMode} disabled={anyBusy}>
          {copy.toggle}
        </button>

        <div className="ad-divider" aria-hidden="true">
          또는
        </div>

        <button
          type="button"
          className="ad-btn ad-btn-block"
          onClick={onGuest}
          disabled={anyBusy}
          aria-busy={guestBusy || undefined}
        >
          {guestBusy ? '처리 중…' : '게스트로 시작하기'}
        </button>
      </div>
    </div>
  )
}
