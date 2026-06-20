/**
 * AuthDesk — 단일 파일 벤더링 컴포넌트 (의존성: react 만).
 * ──────────────────────────────────────────────────────────────────────────
 * npm publish 가 막힌 동안 형제/외부 앱에 그대로 복붙해서 쓰는 버전입니다.
 * 워크스페이스 의존(@authdesk/shared·@authdesk/widget) 0 — 필요한 정책·SDK 클라이언트
 * 로직을 이 파일에 인라인했습니다. 동작/디자인은 @authdesk/widget 의 <AuthForm> 과 동일합니다.
 *
 * 사용:
 *   import { AuthForm } from './AuthForm'
 *   <AuthForm publishableKey="pk_…" endpoint="https://auth.example.com"
 *             onAuthenticated={(r) => console.log(r.user.email)} />
 *
 * 백엔드 계약(공개·publishable 키, X-Authdesk-Key 헤더):
 *   POST {endpoint}/api/auth/register  { email, password, name }      → { user, token, expiresIn }
 *   POST {endpoint}/api/auth/login     { email, password }            → { user, token, expiresIn }
 *   GET  {endpoint}/api/auth/me        (Authorization: Bearer <JWT>)  → EndUser
 *   POST {endpoint}/api/auth/logout    (Authorization: Bearer <JWT>)  → { ok: true }
 *
 * 접근성/디자인: focus-visible · prefers-reduced-motion · 대비 ≥4.5:1 ·
 * 그라디언트 텍스트/글래스모피즘/사이드스트라이프 없음 · 외부 CSS 프레임워크 0.
 * ──────────────────────────────────────────────────────────────────────────
 */
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

/* ============================ 공유 계약(인라인) ============================ */

const PASSWORD_MIN = 8
const PASSWORD_MAX = 200
const WIDGET_VERSION = '0.1.0-vendor'

export interface EndUser {
  id: string
  email: string
  name: string
  verified: boolean
  createdAt: string
}

export interface AuthResult {
  user: EndUser
  token: string
  expiresIn: number
}

const CLASS_RE: ReadonlyArray<RegExp> = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]

function passwordClassCount(password: string): number {
  return CLASS_RE.reduce((n, re) => (re.test(password) ? n + 1 : n), 0)
}

/** 비밀번호 정책(서버와 동일 규칙): 길이 8~200 · 2종류 이상 문자 클래스 · 공백만 금지. */
function validatePassword(password: string): { ok: boolean; reason?: string } {
  if (password.length < PASSWORD_MIN) return { ok: false, reason: `비밀번호는 최소 ${PASSWORD_MIN}자 이상이어야 합니다` }
  if (password.length > PASSWORD_MAX) return { ok: false, reason: `비밀번호는 최대 ${PASSWORD_MAX}자 이하여야 합니다` }
  if (password.trim().length === 0) return { ok: false, reason: '비밀번호는 공백만으로 구성할 수 없습니다' }
  if (passwordClassCount(password) < 2) return { ok: false, reason: '영문 대/소문자·숫자·기호 중 2종류 이상을 포함해야 합니다' }
  return { ok: true }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/* ============================ SDK 클라이언트(인라인) ============================ */

class AuthDeskError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'AuthDeskError'
  }
}

function messageFromBody(body: unknown, status: number): string {
  const rec = (body ?? {}) as Record<string, unknown>
  const raw = rec.message ?? rec.error ?? `AuthDesk 요청 실패 (${status})`
  return Array.isArray(raw) ? raw.join(', ') : String(raw)
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

interface VendorClient {
  register(input: { email: string; password: string; name: string }): Promise<AuthResult>
  login(input: { email: string; password: string }): Promise<AuthResult>
  getSession(): Promise<EndUser | null>
  logout(): Promise<void>
}

function createClient(publishableKey: string, endpoint: string, storageKey: string): VendorClient {
  const base = endpoint.replace(/\/+$/, '')
  const getToken = (): string | null =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null
  const setToken = (token: string | null): void => {
    if (typeof localStorage === 'undefined') return
    if (token) localStorage.setItem(storageKey, token)
    else localStorage.removeItem(storageKey)
  }

  async function call<T>(path: string, method: string, body?: unknown, bearer?: string): Promise<T> {
    const headers: Record<string, string> = {
      'x-authdesk-key': publishableKey,
      'x-authdesk-widget': WIDGET_VERSION,
    }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (bearer) headers.authorization = `Bearer ${bearer}`
    const res = await fetch(`${base}/api/${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const text = await res.text()
    const parsed: unknown = text ? safeJson(text) : null
    if (!res.ok) throw new AuthDeskError(messageFromBody(parsed, res.status), res.status)
    return parsed as T
  }

  return {
    async register(input) {
      const result = await call<AuthResult>('auth/register', 'POST', input)
      setToken(result.token)
      return result
    },
    async login(input) {
      const result = await call<AuthResult>('auth/login', 'POST', input)
      setToken(result.token)
      return result
    },
    async getSession() {
      const token = getToken()
      if (!token) return null
      try {
        return await call<EndUser>('auth/me', 'GET', undefined, token)
      } catch (err) {
        if (err instanceof AuthDeskError && (err.status === 401 || err.status === 403)) {
          setToken(null)
          return null
        }
        throw err
      }
    },
    async logout() {
      const token = getToken()
      if (token) {
        try {
          await call<{ ok: true }>('auth/logout', 'POST', undefined, token)
        } catch {
          // best-effort
        }
      }
      setToken(null)
    },
  }
}

/* ============================ 컴포넌트 ============================ */

export interface AuthFormProps {
  publishableKey: string
  endpoint: string
  onAuthenticated?: (result: AuthResult) => void
  onSignOut?: () => void
  onError?: (error: Error) => void
  initialMode?: 'login' | 'register'
  loginOnly?: boolean
  accent?: string
  accentInk?: string
  title?: string
  /** localStorage 토큰 키. 기본 'authdesk.token'. */
  storageKey?: string
}

const DEFAULT_ACCENT = '#2f5fe0'
const DEFAULT_ACCENT_INK = '#ffffff'
const STYLE_ID = 'authdesk-vendor-styles'

export function AuthForm(props: AuthFormProps): ReactElement {
  const {
    publishableKey,
    endpoint,
    onAuthenticated,
    onSignOut,
    onError,
    initialMode = 'login',
    loginOnly = false,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    title = 'AuthDesk',
    storageKey = 'authdesk.token',
  } = props

  const client = useMemo(
    () => createClient(publishableKey, endpoint, storageKey),
    [publishableKey, endpoint, storageKey]
  )

  const [mode, setMode] = useState<'login' | 'register'>(loginOnly ? 'login' : initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<EndUser | null>(null)
  const baseId = useId()

  useEffect(() => {
    ensureStyles()
  }, [])

  useEffect(() => {
    let ignore = false
    client
      .getSession()
      .then((u) => {
        if (!ignore && u) setUser(u)
      })
      .catch(() => undefined)
    return () => {
      ignore = true
    }
  }, [client])

  const onSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault()
      setError(null)
      const normEmail = normalizeEmail(email)
      if (mode === 'register') {
        const verdict = validatePassword(password)
        if (!verdict.ok) {
          setError(verdict.reason ?? '비밀번호가 정책을 충족하지 않습니다')
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
        setPassword('')
        onAuthenticated?.(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : '요청에 실패했습니다'
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
    } finally {
      setBusy(false)
      setUser(null)
      setEmail('')
      setPassword('')
      setName('')
      onSignOut?.()
    }
  }, [client, onSignOut])

  const rootStyle = {
    '--adv-accent': accent,
    '--adv-accent-ink': accentInk,
  } as CSSProperties

  if (user) {
    return (
      <div className="adv-root" style={rootStyle}>
        <div className="adv-card" style={{ textAlign: 'center' }}>
          <p className="adv-name">{user.name}</p>
          <p className="adv-email">{user.email}</p>
          <button type="button" className="adv-secondary" onClick={() => void signOut()} disabled={busy}>
            로그아웃
          </button>
        </div>
      </div>
    )
  }

  const isRegister = mode === 'register'
  const emailId = `${baseId}-email`
  const passwordId = `${baseId}-password`
  const nameId = `${baseId}-name`

  return (
    <div className="adv-root" style={rootStyle}>
      <form className="adv-card" onSubmit={onSubmit} noValidate>
        <p className="adv-title">{title}</p>
        <p className="adv-subtitle">{isRegister ? '새 계정을 만드세요.' : '계정에 로그인하세요.'}</p>

        {!loginOnly ? (
          <div className="adv-tabs" role="tablist" aria-label="인증 모드">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={`adv-tab${!isRegister ? ' adv-active' : ''}`}
              onClick={() => {
                setMode('login')
                setError(null)
              }}
            >
              로그인
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={`adv-tab${isRegister ? ' adv-active' : ''}`}
              onClick={() => {
                setMode('register')
                setError(null)
              }}
            >
              가입
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="adv-alert" role="alert">
            {error}
          </div>
        ) : null}

        {isRegister ? (
          <label className="adv-field" htmlFor={nameId}>
            <span className="adv-label">이름</span>
            <input
              id={nameId}
              className="adv-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              autoComplete="name"
              maxLength={120}
              required
            />
          </label>
        ) : null}

        <label className="adv-field" htmlFor={emailId}>
          <span className="adv-label">이메일</span>
          <input
            id={emailId}
            className="adv-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="adv-field" htmlFor={passwordId}>
          <span className="adv-label">비밀번호</span>
          <input
            id={passwordId}
            className="adv-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegister ? '8자 이상, 2종류 이상' : '비밀번호'}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
          />
        </label>

        <button type="submit" className="adv-submit" disabled={busy || !email || !password}>
          {busy ? '처리 중…' : isRegister ? '가입하기' : '로그인'}
        </button>
      </form>
    </div>
  )
}

/* ============================ 스타일(인라인 주입) ============================ */

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = VENDOR_CSS
  document.head.appendChild(el)
}

const VENDOR_CSS = `
.adv-root, .adv-root * { box-sizing: border-box; }
.adv-root {
  --adv-accent: ${DEFAULT_ACCENT};
  --adv-accent-ink: ${DEFAULT_ACCENT_INK};
  --adv-ink: #1a1d23; --adv-muted: #6b7280; --adv-surface: #fff;
  --adv-surface-2: #f4f5f7; --adv-border: #d7dae0; --adv-border-strong: #b7bcc6;
  --adv-danger: #b42318;
  display: block; width: 100%; max-width: 380px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--adv-ink); line-height: 1.5;
}
.adv-card { border: 1px solid var(--adv-border); border-radius: 14px; background: var(--adv-surface); padding: 24px; }
.adv-title { margin: 0 0 4px; font-size: 19px; font-weight: 700; }
.adv-subtitle { margin: 0 0 18px; font-size: 13px; color: var(--adv-muted); }
.adv-name { margin: 0 0 2px; font-size: 16px; font-weight: 700; }
.adv-email { margin: 0 0 16px; font-size: 13px; color: var(--adv-muted); }
.adv-tabs { display: flex; gap: 4px; padding: 3px; margin-bottom: 18px; background: var(--adv-surface-2); border-radius: 9px; }
.adv-tab { flex: 1; padding: 7px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--adv-muted); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.adv-tab.adv-active { background: var(--adv-surface); color: var(--adv-ink); box-shadow: 0 1px 2px rgba(16,24,40,.08); }
.adv-field { display: block; margin-bottom: 14px; }
.adv-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.adv-input { width: 100%; padding: 10px 12px; font: inherit; font-size: 14px; border: 1px solid var(--adv-border-strong); border-radius: 9px; background: var(--adv-surface); color: var(--adv-ink); }
.adv-input:focus-visible { border-color: var(--adv-accent); }
.adv-submit { width: 100%; padding: 11px 16px; border: 1px solid var(--adv-accent); border-radius: 9px; background: var(--adv-accent); color: var(--adv-accent-ink); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.adv-submit:hover { filter: brightness(1.06); }
.adv-submit:disabled { opacity: .6; cursor: not-allowed; }
.adv-secondary { width: 100%; padding: 9px 16px; border: 1px solid var(--adv-border-strong); border-radius: 9px; background: var(--adv-surface); color: var(--adv-ink); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.adv-alert { padding: 10px 12px; border-radius: 9px; font-size: 13px; margin-bottom: 14px; background: color-mix(in srgb, var(--adv-danger) 9%, var(--adv-surface)); color: var(--adv-danger); border: 1px solid color-mix(in srgb, var(--adv-danger) 28%, var(--adv-surface)); }
.adv-root :focus { outline: none; }
.adv-root :focus-visible { outline: 2px solid var(--adv-accent); outline-offset: 2px; border-radius: 8px; }
@media (prefers-reduced-motion: reduce) { .adv-root * { transition-duration: .001ms !important; animation-duration: .001ms !important; } }
`
