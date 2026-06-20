import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { TenantCreatedDto } from '@addesk/shared'
import type { FormEvent, ReactElement } from 'react'

import { sessionStore } from '@/app/sessionStore'
import { useDocumentTitle } from '@/app/useDocumentTitle'
import { signup } from '@/services/ads'
import { ApiError } from '@/services/api'

export function SignupPage(): ReactElement {
  useDocumentTitle('가입')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [corsOrigins, setCorsOrigins] = useState('*')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creds, setCreds] = useState<TenantCreatedDto | null>(null)

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
        <div className="ax-alert ax-alert-success">
          secret 키는 지금 한 번만 표시됩니다. 안전한 곳에 보관하세요.
        </div>
        <div className="ax-card ax-stack">
          <div>
            <p className="ax-label">테넌트</p>
            <p style={{ margin: 0 }}>
              {creds.tenant.name} <span className="ax-muted">({creds.tenant.slug})</span>
            </p>
          </div>
          <div>
            <p className="ax-label">publishable 키 (pk_) — 브라우저 노출 안전</p>
            <pre className="ax-code">{creds.publishableKey}</pre>
          </div>
          <div>
            <p className="ax-label">secret 키 (sk_) — 서버 전용, 1회 노출</p>
            <pre className="ax-code">{creds.secretKey}</pre>
          </div>
          <button type="button" className="ax-btn ax-btn-primary" onClick={useThisKey}>
            이 키로 대시보드 열기
          </button>
        </div>
      </section>
    )
  }

  return (
    <section style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, letterSpacing: '-0.02em' }}>가입</h1>
      <p className="ax-muted">테넌트를 만들면 pk_/sk_ 키쌍이 발급됩니다.</p>
      {error ? <div className="ax-alert ax-alert-error">{error}</div> : null}
      <form className="ax-card" onSubmit={onSubmit}>
        <label className="ax-field">
          <span className="ax-label">테넌트 이름</span>
          <input
            className="ax-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc"
            required
            maxLength={120}
          />
        </label>
        <label className="ax-field">
          <span className="ax-label">CORS 허용 출처 (쉼표 구분, 기본 *)</span>
          <input
            className="ax-input"
            value={corsOrigins}
            onChange={(e) => setCorsOrigins(e.target.value)}
            placeholder="https://app.example.com, https://www.example.com"
          />
        </label>
        <button type="submit" className="ax-btn ax-btn-primary" disabled={busy || !name.trim()}>
          {busy ? '생성 중…' : '가입하기'}
        </button>
      </form>
    </section>
  )
}
