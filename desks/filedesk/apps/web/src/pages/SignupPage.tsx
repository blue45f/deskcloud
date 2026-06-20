import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { TenantCredentialsDto } from '@filedesk/shared'
import type { FormEvent, ReactElement } from 'react'

import { sessionStore } from '@/app/sessionStore'
import { useDocumentTitle } from '@/app/useDocumentTitle'
import { ApiError } from '@/services/api'
import { signup } from '@/services/files'


export function SignupPage(): ReactElement {
  useDocumentTitle('가입')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [corsOrigins, setCorsOrigins] = useState('*')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creds, setCreds] = useState<TenantCredentialsDto | null>(null)

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const origins = corsOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const result = await signup({
        name: name.trim(),
        corsOrigins: origins.length > 0 ? origins : undefined,
      })
      setCreds(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '가입에 실패했습니다')
    } finally {
      setBusy(false)
    }
  }

  const useThisKey = (): void => {
    if (!creds) return
    sessionStore.setSecretKey(creds.secretKey)
    navigate('/dashboard')
  }

  if (creds) {
    return (
      <section style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.02em' }}>가입 완료 🎉</h1>
        <div className="fd-alert fd-alert-success">
          secret 키는 지금 한 번만 표시됩니다. 안전한 곳에 보관하세요.
        </div>
        <div className="fd-card fd-stack">
          <div>
            <p className="fd-label">테넌트</p>
            <p style={{ margin: 0 }}>
              {creds.name} <span className="fd-muted">({creds.slug})</span>
            </p>
          </div>
          <div>
            <p className="fd-label">publishable 키 (pk_) — 브라우저 노출 안전</p>
            <pre className="fd-code">{creds.publishableKey}</pre>
          </div>
          <div>
            <p className="fd-label">secret 키 (sk_) — 서버 전용, 1회 노출</p>
            <pre className="fd-code">{creds.secretKey}</pre>
          </div>
          <button type="button" className="fd-btn fd-btn-primary" onClick={useThisKey}>
            이 키로 대시보드 열기
          </button>
        </div>
      </section>
    )
  }

  return (
    <section style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, letterSpacing: '-0.02em' }}>가입</h1>
      <p className="fd-muted">테넌트를 만들면 pk_/sk_ 키쌍이 발급됩니다.</p>
      {error ? <div className="fd-alert fd-alert-error">{error}</div> : null}
      <form className="fd-card" onSubmit={onSubmit}>
        <label className="fd-field">
          <span className="fd-label">테넌트 이름</span>
          <input
            className="fd-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc"
            required
            maxLength={120}
          />
        </label>
        <label className="fd-field">
          <span className="fd-label">CORS 허용 출처 (쉼표 구분, 기본 *)</span>
          <input
            className="fd-input"
            value={corsOrigins}
            onChange={(e) => setCorsOrigins(e.target.value)}
            placeholder="https://app.example.com, https://www.example.com"
          />
        </label>
        <button type="submit" className="fd-btn fd-btn-primary" disabled={busy || !name.trim()}>
          {busy ? '생성 중…' : '가입하기'}
        </button>
      </form>
    </section>
  )
}
