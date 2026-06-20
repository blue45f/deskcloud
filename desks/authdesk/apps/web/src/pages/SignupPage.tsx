import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { TenantWithSecretDto } from '@authdesk/shared'
import type { FormEvent, ReactElement } from 'react'

import { sessionStore } from '@/app/sessionStore'
import { useDocumentTitle } from '@/app/useDocumentTitle'
import { ApiError } from '@/services/api'
import { signup } from '@/services/auth'

/** 이름 → slug 후보(소문자·하이픈). 사용자가 직접 수정 가능. */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function SignupPage(): ReactElement {
  useDocumentTitle('가입')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [corsOrigins, setCorsOrigins] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creds, setCreds] = useState<TenantWithSecretDto | null>(null)

  const onNameChange = (value: string): void => {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

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
        slug: slug.trim() || slugify(name),
        plan: 'free',
        corsOrigins: origins,
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
        <div className="ad-alert ad-alert-success">
          secret 키는 지금 한 번만 표시됩니다. 안전한 곳에 보관하세요.
        </div>
        <div className="ad-card ad-stack">
          <div>
            <p className="ad-label">테넌트</p>
            <p style={{ margin: 0 }}>
              {creds.name} <span className="ad-muted">({creds.slug})</span>
            </p>
          </div>
          <div>
            <p className="ad-label">publishable 키 (pk_) — 브라우저 노출 안전</p>
            <pre className="ad-code">{creds.publishableKey}</pre>
          </div>
          <div>
            <p className="ad-label">secret 키 (sk_) — 서버 전용, 1회 노출</p>
            <pre className="ad-code">{creds.secretKey}</pre>
          </div>
          <button type="button" className="ad-btn ad-btn-primary" onClick={useThisKey}>
            이 키로 대시보드 열기
          </button>
        </div>
      </section>
    )
  }

  return (
    <section style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, letterSpacing: '-0.02em' }}>가입</h1>
      <p className="ad-muted">테넌트(앱)를 만들면 pk_/sk_ 키쌍이 발급됩니다.</p>
      {error ? (
        <div className="ad-alert ad-alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <form className="ad-card" onSubmit={onSubmit}>
        <label className="ad-field">
          <span className="ad-label">앱 이름</span>
          <input
            className="ad-input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Acme Inc"
            required
            maxLength={120}
          />
        </label>
        <label className="ad-field">
          <span className="ad-label">slug (소문자·숫자·하이픈)</span>
          <input
            className="ad-input"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugEdited(true)
            }}
            placeholder="acme"
            required
            maxLength={64}
          />
        </label>
        <label className="ad-field">
          <span className="ad-label">CORS 허용 출처 (쉼표 구분, 위젯이 붙을 도메인)</span>
          <input
            className="ad-input"
            value={corsOrigins}
            onChange={(e) => setCorsOrigins(e.target.value)}
            placeholder="https://app.example.com, https://www.example.com"
          />
        </label>
        <button
          type="submit"
          className="ad-btn ad-btn-primary"
          disabled={busy || !name.trim() || !slug.trim()}
        >
          {busy ? '생성 중…' : '가입하기'}
        </button>
      </form>
    </section>
  )
}
