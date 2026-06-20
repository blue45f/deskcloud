import { AuthForm } from '@authdesk/widget'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'

const TOKENS: { name: string; var: string; ink?: string }[] = [
  { name: 'accent', var: '--ad-accent', ink: 'var(--ad-accent-ink)' },
  { name: 'surface', var: '--ad-surface', ink: 'var(--ad-ink)' },
  { name: 'surface-2', var: '--ad-surface-2', ink: 'var(--ad-ink)' },
  { name: 'ink', var: '--ad-ink', ink: '#fff' },
  { name: 'muted', var: '--ad-muted', ink: '#fff' },
  { name: 'danger', var: '--ad-danger', ink: '#fff' },
  { name: 'success', var: '--ad-success', ink: '#fff' },
]

const DEMO_ENDPOINT =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/** /design — 리빙 스타일가이드. 토큰·컴포넌트·위젯을 한 화면에 모아 회귀를 눈으로 잡는다. */
export function DesignPage(): ReactElement {
  useDocumentTitle('디자인 시스템')
  return (
    <>
      <section className="ad-hero" style={{ paddingBottom: 8 }}>
        <h1 style={{ fontSize: 32 }}>디자인 시스템</h1>
        <p>AuthDesk 어드민·위젯의 토큰과 컴포넌트. 외부 CSS 프레임워크 0, OKLCH 기반 accent.</p>
      </section>

      <section className="ad-section">
        <h2>색상 토큰</h2>
        <div className="ad-grid cols-4">
          {TOKENS.map((t) => (
            <div
              key={t.name}
              className="ad-swatch"
              style={{ background: `var(${t.var})`, color: t.ink ?? 'var(--ad-ink)' }}
            >
              {t.name}
            </div>
          ))}
        </div>
      </section>

      <section className="ad-section">
        <h2>버튼</h2>
        <div className="ad-card ad-row">
          <button type="button" className="ad-btn ad-btn-primary">
            Primary
          </button>
          <button type="button" className="ad-btn">
            Secondary
          </button>
          <button type="button" className="ad-btn ad-btn-danger">
            Danger
          </button>
          <button type="button" className="ad-btn ad-btn-sm">
            Small
          </button>
          <button type="button" className="ad-btn ad-btn-primary" disabled>
            Disabled
          </button>
        </div>
      </section>

      <section className="ad-section">
        <h2>뱃지</h2>
        <div className="ad-card ad-row">
          <span className="ad-badge">default</span>
          <span className="ad-badge ad-verified">verified</span>
          <span className="ad-badge ad-unverified">unverified</span>
          <span className="ad-badge ad-accentish">추천</span>
        </div>
      </section>

      <section className="ad-section">
        <h2>폼</h2>
        <div className="ad-card" style={{ maxWidth: 420 }}>
          <label className="ad-field">
            <span className="ad-label">텍스트 입력</span>
            <input className="ad-input" placeholder="placeholder…" />
          </label>
        </div>
      </section>

      <section className="ad-section">
        <h2>알림</h2>
        <div className="ad-stack">
          <div className="ad-alert ad-alert-success">성공 메시지 예시입니다.</div>
          <div className="ad-alert ad-alert-error">오류 메시지 예시입니다.</div>
        </div>
      </section>

      <section className="ad-section">
        <h2>인증 위젯</h2>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <AuthForm publishableKey="pk_demo" endpoint={DEMO_ENDPOINT} storage="memory" />
        </div>
      </section>
    </>
  )
}
