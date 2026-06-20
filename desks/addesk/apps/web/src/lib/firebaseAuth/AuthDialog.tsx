import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useAuth } from './useAuth'

import type { FormEvent, ReactElement } from 'react'

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

/** 포커스 가능한 자식 노드 셀렉터(모달 포커스 트랩용). */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Firebase 이메일/비밀번호 + 게스트 로그인 다이얼로그 — 접근성 우선.
 * - 로그인 ⇄ 가입 토글, "게스트로 시작하기"(익명 인증)
 * - 로딩/비활성 상태, aria-live 에러(role="alert")
 * - 포커스: 열릴 때 이메일 입력에 초기 포커스, 모달 안에 포커스 트랩, Esc 로 닫힘,
 *   배경 스크롤 잠금, 닫힐 때 트리거로 포커스 복귀
 *
 * AdDesk 는 Radix/Tailwind 가 없는 자체 CSS 디자인 시스템(`ax-*` 토큰)이라,
 * 다른 형제 앱의 Radix Dialog 버전 대신 네이티브 모달로 적응했다. useAuth API 와
 * 한국어 에러 매핑(context.ts)은 동일하게 유지한다.
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
  const panelRef = useRef<HTMLDivElement>(null)

  const titleId = useId()
  const descId = useId()
  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()

  /** 부모에 닫힘만 알린다(로컬 상태 초기화 X — effect 안에서 호출해도 안전). */
  const requestClose = useCallback(() => onOpenChange(false), [onOpenChange])

  // 로그인 성공 시 자동으로 닫힌다(prop 콜백만 호출 — setState 아님).
  useEffect(() => {
    if (open && user) requestClose()
  }, [open, user, requestClose])

  // 열릴 때: 트리거 기억 + 이메일 포커스 + 배경 스크롤 잠금 + 키 핸들링.
  // 닫힐 때(cleanup): 스크롤 복원 + 트리거로 포커스 복귀 + 컨텍스트 에러 정리.
  //
  // 로컬 폼 상태(mode/email/password/busy)는 닫힘 시 컴포넌트가 언마운트되므로(아래
  // `if (!open) return null`) 다음 열림에 useState 초기값으로 자연 리셋된다 — effect
  // 안에서 동기 setState 를 하지 않는다(react-hooks/set-state-in-effect 준수).
  useEffect(() => {
    if (!open) return

    const trigger = document.activeElement as HTMLElement | null
    const focusId = window.setTimeout(() => emailRef.current?.focus(), 0)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE)
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
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      window.clearTimeout(focusId)
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = prevOverflow
      trigger?.focus?.()
      // 다음 열림에 직전 세션의 에러가 남지 않도록 닫힘(cleanup) 시 정리한다.
      // (cleanup 의 setState 는 effect 본문이 아니라 허용된다.)
      clearError()
    }
    // clearError/requestClose 는 안정적인 콜백이라 의존성에 포함해도 재실행을 유발하지 않는다.
  }, [open, clearError, requestClose])

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

  return createPortal(
    <div className="ax-auth-overlay">
      {/* 배경 클릭으로 닫기(키보드 사용자는 Esc — 위 document 리스너). */}
      <button
        type="button"
        className="ax-auth-scrim"
        aria-label="닫기"
        tabIndex={-1}
        onClick={requestClose}
      />
      <div
        ref={panelRef}
        className="ax-auth-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="ax-auth-head">
          <span className="ax-auth-mark" aria-hidden="true">
            {mode === 'signup' ? '＋' : '→'}
          </span>
          <div>
            <h2 id={titleId} className="ax-auth-title">
              {copy.title}
            </h2>
            <p id={descId} className="ax-auth-desc">
              {copy.desc}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="ax-auth-form">
          <label className="ax-field" htmlFor={emailId}>
            <span className="ax-label">이메일</span>
            <input
              ref={emailRef}
              id={emailId}
              className="ax-input"
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

          <label className="ax-field" htmlFor={passwordId}>
            <span className="ax-label">비밀번호</span>
            <input
              id={passwordId}
              className="ax-input"
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
          <div aria-live="assertive" className="ax-auth-live">
            {error ? (
              <p id={errorId} role="alert" className="ax-alert ax-alert-error">
                {error}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="ax-btn ax-btn-primary ax-auth-full"
            disabled={anyBusy || !email || !password}
            aria-busy={formBusy || undefined}
          >
            {formBusy ? '처리 중…' : copy.submit}
          </button>
        </form>

        <button type="button" onClick={switchMode} disabled={anyBusy} className="ax-auth-toggle">
          {copy.toggle}
        </button>

        <div className="ax-auth-divider" aria-hidden="true">
          <span className="ax-auth-divider-line" />
          <span className="ax-auth-divider-label">또는</span>
          <span className="ax-auth-divider-line" />
        </div>

        <button
          type="button"
          onClick={onGuest}
          disabled={anyBusy}
          aria-busy={guestBusy || undefined}
          className="ax-btn ax-auth-full"
        >
          {guestBusy ? '처리 중…' : '게스트로 시작하기'}
        </button>
      </div>
    </div>,
    document.body
  )
}
