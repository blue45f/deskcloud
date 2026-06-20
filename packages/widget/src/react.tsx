/**
 * @authdesk/widget/react — <AuthForm> 컴포넌트.
 *
 * 로그인/가입 탭 전환 폼 + 인라인 검증 + 로딩/에러/성공 상태 + 로그인 후 사용자 카드(로그아웃).
 * publishable(pk_) 키로 end-user 를 인증한다(브라우저 노출 안전). 클라이언트단 비밀번호 정책은
 * @authdesk/shared 의 validatePassword 를 그대로 써 서버와 동일 규칙을 적용한다.
 *
 * 의존성은 react(peer)뿐. 외부 CSS 프레임워크 0(스코프 .ad-* 스타일).
 */
import {
  normalizeEmail,
  validatePassword,
  type AuthResultDto,
  type EndUserDto,
} from '@authdesk/shared'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactElement,
} from 'react'

import { AuthDeskError, createAuthDeskClient, type AuthDeskClient } from './client'
import { AlertIcon, CheckIcon, LockIcon, MailIcon, SpinnerIcon, UserIcon } from './icons'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'

export type AuthMode = 'login' | 'register'

export interface AuthFormProps {
  /** publishable 키(`pk_…`). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://auth.example.com'. */
  endpoint: string
  /** 로그인/가입 성공 콜백(사용자 + 토큰). */
  onAuthenticated?: (result: AuthResultDto) => void
  /** 로그아웃 콜백. */
  onSignOut?: () => void
  /** 실패 콜백. */
  onError?: (error: Error) => void
  /** 초기 모드. 기본 'login'. */
  initialMode?: AuthMode
  /** 가입 탭을 숨기고 로그인만 노출. 기본 false. */
  loginOnly?: boolean
  /** 액세스 토큰 보관 방식(기본 'local' — 새로고침에도 세션 유지). */
  storage?: 'local' | 'memory' | 'none'
  /** 강조색. 기본 #2f5fe0. */
  accent?: string
  /** accent 위 텍스트색. 기본 흰색. */
  accentInk?: string
  /** 폼 제목. 기본 'AuthDesk'. */
  title?: string
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유용). */
  client?: AuthDeskClient
}

type Phase = 'form' | 'signed-in'

export function AuthForm(props: AuthFormProps): ReactElement {
  const {
    publishableKey,
    endpoint,
    onAuthenticated,
    onSignOut,
    onError,
    initialMode = 'login',
    loginOnly = false,
    storage = 'local',
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    title = 'AuthDesk',
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<AuthDeskClient>(
    () =>
      injectedClient ??
      createAuthDeskClient({ publishableKey, endpoint, storage, fetch: customFetch }),
    [injectedClient, publishableKey, endpoint, storage, customFetch]
  )

  const [mode, setMode] = useState<AuthMode>(loginOnly ? 'login' : initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('form')
  const [user, setUser] = useState<EndUserDto | null>(null)

  const baseId = useId()
  const theme: WidgetTheme = { accent, accentInk }

  if (typeof document !== 'undefined') ensureStyles()

  // 마운트 시 보관 토큰이 있으면 세션을 복원한다.
  useEffect(() => {
    let ignore = false
    client
      .getSession()
      .then((u) => {
        if (!ignore && u) {
          setUser(u)
          setPhase('signed-in')
        }
      })
      .catch(() => undefined)
    return () => {
      ignore = true
    }
  }, [client])

  // 방문 핑 — 위젯이 임베드된 페이지의 한 방문을 그 테넌트로 집계한다(fire-and-forget).
  // 클라이언트가 실패를 삼키므로 가입/로그인 UX 에는 영향이 없다.
  useEffect(() => {
    void client.trackVisit()
  }, [client])

  const switchMode = useCallback((next: AuthMode) => {
    setMode(next)
    setError(null)
  }, [])

  const onSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault()
      setError(null)

      const normEmail = normalizeEmail(email)
      if (mode === 'register') {
        const verdict = validatePassword(password)
        if (!verdict.ok) {
          setError(verdict.reasons[0] ?? '비밀번호가 정책을 충족하지 않습니다')
          return
        }
        if (name.trim().length === 0) {
          setError('이름을 입력하세요')
          return
        }
      }

      setBusy(true)
      try {
        const result =
          mode === 'register'
            ? await client.register({ email: normEmail, password, name: name.trim() })
            : await client.login({ email: normEmail, password })
        setUser(result.user)
        setPhase('signed-in')
        setPassword('')
        onAuthenticated?.(result)
      } catch (err) {
        const message =
          err instanceof AuthDeskError || err instanceof Error ? err.message : '요청에 실패했습니다'
        setError(message)
        onError?.(err instanceof Error ? err : new Error(message))
      } finally {
        setBusy(false)
      }
    },
    [client, mode, email, password, name, onAuthenticated, onError]
  )

  const signOut = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      await client.logout()
    } catch {
      // 로그아웃은 best-effort — 실패해도 로컬 상태는 비운다.
    } finally {
      setBusy(false)
      setUser(null)
      setPhase('form')
      setEmail('')
      setPassword('')
      setName('')
      onSignOut?.()
    }
  }, [client, onSignOut])

  const rootStyle = themeVars(theme) as CSSProperties

  if (phase === 'signed-in' && user) {
    return (
      <div className="ad-root" style={rootStyle}>
        <div className="ad-card ad-signed-in">
          <span className="ad-avatar" aria-hidden="true">
            <UserIcon />
          </span>
          <p className="ad-signed-name">{user.name}</p>
          <p className="ad-signed-email">{user.email}</p>
          <button
            type="button"
            className="ad-secondary"
            onClick={() => void signOut()}
            disabled={busy}
          >
            로그아웃
          </button>
          <p className="ad-foot">AuthDesk 로 보호되는 세션</p>
        </div>
      </div>
    )
  }

  const emailId = `${baseId}-email`
  const passwordId = `${baseId}-password`
  const nameId = `${baseId}-name`
  const isRegister = mode === 'register'

  return (
    <div className="ad-root" style={rootStyle}>
      <form className="ad-card" onSubmit={onSubmit} noValidate>
        <p className="ad-title">{title}</p>
        <p className="ad-subtitle">{isRegister ? '새 계정을 만드세요.' : '계정에 로그인하세요.'}</p>

        {!loginOnly ? (
          <div className="ad-tabs" role="tablist" aria-label="인증 모드">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={`ad-tab${!isRegister ? ' ad-active' : ''}`}
              onClick={() => switchMode('login')}
            >
              로그인
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={`ad-tab${isRegister ? ' ad-active' : ''}`}
              onClick={() => switchMode('register')}
            >
              가입
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="ad-alert ad-alert-error" role="alert">
            <AlertIcon />
            <span>{error}</span>
          </div>
        ) : null}

        {isRegister ? (
          <label className="ad-field" htmlFor={nameId}>
            <span className="ad-label">이름</span>
            <span className="ad-input-wrap">
              <span className="ad-input-icon">
                <UserIcon />
              </span>
              <input
                id={nameId}
                className="ad-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                autoComplete="name"
                maxLength={120}
                required
              />
            </span>
          </label>
        ) : null}

        <label className="ad-field" htmlFor={emailId}>
          <span className="ad-label">이메일</span>
          <span className="ad-input-wrap">
            <span className="ad-input-icon">
              <MailIcon />
            </span>
            <input
              id={emailId}
              className="ad-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </span>
        </label>

        <label className="ad-field" htmlFor={passwordId}>
          <span className="ad-label">비밀번호</span>
          <span className="ad-input-wrap">
            <span className="ad-input-icon">
              <LockIcon />
            </span>
            <input
              id={passwordId}
              className="ad-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? '8자 이상, 2종류 이상' : '비밀번호'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />
          </span>
        </label>

        <button type="submit" className="ad-submit" disabled={busy || !email || !password}>
          {busy ? (
            <>
              <SpinnerIcon />
              처리 중…
            </>
          ) : isRegister ? (
            <>
              <CheckIcon />
              가입하기
            </>
          ) : (
            '로그인'
          )}
        </button>

        <p className="ad-foot">AuthDesk 로 보호됩니다</p>
      </form>
    </div>
  )
}
