import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'

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

/** 모달 안에서 포커스 가능한 요소들(포커스 트랩용). */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Firebase 이메일/비밀번호 + 게스트 로그인 다이얼로그 — 접근성 우선.
 * - 로그인 ⇄ 가입 토글, "게스트로 시작하기"(익명 인증)
 * - 로딩/비활성 상태, aria-live 에러
 * - 포커스: 열릴 때 이메일 입력에 초기 포커스, Tab 트랩, Esc 닫기, 닫히면 트리거로 복귀
 *
 * FileDesk 의 자체 CSS 디자인 시스템(`fd-*`, Tailwind/Radix 없음)에 맞춰 네이티브
 * 모달 오버레이로 구현했다. useAuth API·한국어 에러 매핑은 정본과 동일하게 유지한다.
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
  // 열기 직전 포커스를 보관했다가 닫힐 때 복귀(a11y).
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()
  const titleId = useId()
  const descId = useId()

  /** 폼/에러를 초기화하며 닫는다 — 다음 열림이 항상 깨끗한 상태로 시작. */
  const close = useCallback(() => {
    setMode('signin')
    setBusy(null)
    setEmail('')
    setPassword('')
    clearError()
    onOpenChange(false)
  }, [clearError, onOpenChange])

  // 로그인 성공 시 자동으로 닫힌다 — prop 콜백만 호출(effect 내 동기 setState 회피).
  // 닫히면 컴포넌트가 언마운트되므로(`!open` → null) 로컬 폼 state 는 다음 열림에 재초기화된다.
  useEffect(() => {
    if (open && user) onOpenChange(false)
  }, [open, user, onOpenChange])

  // 열릴 때: 트리거 포커스 보관 + 이메일 초기 포커스 + Esc 닫기/Tab 포커스 트랩(document 리스너).
  // 닫힐 때: 리스너 해제 + 트리거로 포커스 복귀. (role="dialog" 노드에 핸들러를 달지 않아 a11y 규칙 충족.)
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    // 마운트 직후 포커스(레이아웃 안정화 후).
    const raf = window.requestAnimationFrame(() => emailRef.current?.focus())

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
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

    document.addEventListener('keydown', handleKey, true)
    return () => {
      window.cancelAnimationFrame(raf)
      document.removeEventListener('keydown', handleKey, true)
      restoreFocusRef.current?.focus?.()
    }
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
    <div className="fd-modal-overlay">
      {/* 배경 클릭 닫기는 전용 버튼으로 — a11y(키보드/role) 충족. 시각적으로만 전면 백드롭. */}
      <button
        type="button"
        className="fd-modal-backdrop"
        aria-label="닫기"
        tabIndex={-1}
        onClick={close}
      />
      <div
        ref={panelRef}
        className="fd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <button
          type="button"
          className="fd-modal-close"
          onClick={close}
          aria-label="닫기"
          disabled={anyBusy}
        >
          <span aria-hidden="true">×</span>
        </button>

        <h2 id={titleId} className="fd-modal-title">
          {copy.title}
        </h2>
        <p id={descId} className="fd-muted fd-modal-desc">
          {copy.desc}
        </p>

        <form onSubmit={onSubmit}>
          <label className="fd-field" htmlFor={emailId}>
            <span className="fd-label">이메일</span>
            <input
              ref={emailRef}
              id={emailId}
              className="fd-input"
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

          <label className="fd-field" htmlFor={passwordId}>
            <span className="fd-label">비밀번호</span>
            <input
              id={passwordId}
              className="fd-input"
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
              <p id={errorId} role="alert" className="fd-alert fd-alert-error">
                {error}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="fd-btn fd-btn-primary fd-modal-submit"
            disabled={anyBusy || !email || !password}
            aria-busy={formBusy || undefined}
          >
            {formBusy ? '처리 중…' : copy.submit}
          </button>
        </form>

        <button type="button" onClick={switchMode} disabled={anyBusy} className="fd-modal-toggle">
          {copy.toggle}
        </button>

        <div className="fd-modal-divider" role="separator">
          <span aria-hidden="true" />
          <span className="fd-muted">또는</span>
          <span aria-hidden="true" />
        </div>

        <button
          type="button"
          onClick={onGuest}
          disabled={anyBusy}
          aria-busy={guestBusy || undefined}
          className="fd-btn fd-modal-submit"
        >
          {guestBusy ? '처리 중…' : '게스트로 시작하기'}
        </button>
      </div>
    </div>
  )
}
