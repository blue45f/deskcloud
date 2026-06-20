import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { FormEvent, ReactElement } from 'react'

import { sessionStore } from '@/app/sessionStore'
import { useDocumentTitle } from '@/app/useDocumentTitle'
import { ApiError } from '@/services/api'
import { getTenant } from '@/services/auth'

export function LoginPage(): ReactElement {
  useDocumentTitle('로그인')
  const navigate = useNavigate()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const trimmed = key.trim()
    if (!trimmed.startsWith('sk_')) {
      setError('secret 키(sk_…)를 입력하세요.')
      return
    }
    setBusy(true)
    // 키를 먼저 보관하고 /tenants/me 로 검증한다(실패 시 해제).
    sessionStore.setSecretKey(trimmed)
    try {
      await getTenant()
      navigate('/dashboard')
    } catch (err) {
      sessionStore.clear()
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ maxWidth: 440, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, letterSpacing: '-0.02em' }}>어드민 로그인</h1>
      <p className="ad-muted">
        테넌트 secret 키(sk_)로 로그인합니다. 데모는 <code className="ad-inline">sk_demo</code> 를
        사용하세요. (end-user 로그인은 임베드 위젯이 담당합니다 — 여기는 운영자 콘솔입니다.)
      </p>
      {error ? (
        <div className="ad-alert ad-alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <form className="ad-card" onSubmit={onSubmit}>
        <label className="ad-field">
          <span className="ad-label">secret 키</span>
          <input
            className="ad-input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk_…"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <button type="submit" className="ad-btn ad-btn-primary" disabled={busy || !key.trim()}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </section>
  )
}
