import { FileUpload } from '@filedesk/widget'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'


const TOKENS: { name: string; var: string; ink?: string }[] = [
  { name: 'accent', var: '--fd-accent', ink: 'var(--fd-accent-ink)' },
  { name: 'surface', var: '--fd-surface', ink: 'var(--fd-ink)' },
  { name: 'surface-2', var: '--fd-surface-2', ink: 'var(--fd-ink)' },
  { name: 'ink', var: '--fd-ink', ink: '#fff' },
  { name: 'muted', var: '--fd-muted', ink: '#fff' },
  { name: 'danger', var: '--fd-danger', ink: '#fff' },
  { name: 'success', var: '--fd-success', ink: '#fff' },
]

const DEMO_ENDPOINT =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/** /design — 리빙 스타일가이드. 토큰·컴포넌트·위젯을 한 화면에 모아 회귀를 눈으로 잡는다. */
export function DesignPage(): ReactElement {
  useDocumentTitle('디자인 시스템')
  return (
    <>
      <section className="fd-hero" style={{ paddingBottom: 8 }}>
        <h1 style={{ fontSize: 32 }}>디자인 시스템</h1>
        <p>FileDesk 어드민·위젯의 토큰과 컴포넌트. 외부 CSS 프레임워크 0, OKLCH 기반 accent.</p>
      </section>

      <section className="fd-section">
        <h2>색상 토큰</h2>
        <div className="fd-grid cols-4">
          {TOKENS.map((t) => (
            <div
              key={t.name}
              className="fd-swatch"
              style={{ background: `var(${t.var})`, color: t.ink ?? 'var(--fd-ink)' }}
            >
              {t.name}
            </div>
          ))}
        </div>
      </section>

      <section className="fd-section">
        <h2>버튼</h2>
        <div className="fd-card fd-row">
          <button type="button" className="fd-btn fd-btn-primary">
            Primary
          </button>
          <button type="button" className="fd-btn">
            Secondary
          </button>
          <button type="button" className="fd-btn fd-btn-danger">
            Danger
          </button>
          <button type="button" className="fd-btn fd-btn-sm">
            Small
          </button>
          <button type="button" className="fd-btn fd-btn-primary" disabled>
            Disabled
          </button>
        </div>
      </section>

      <section className="fd-section">
        <h2>뱃지</h2>
        <div className="fd-card fd-row">
          <span className="fd-badge">default</span>
          <span className="fd-badge fd-public">public</span>
          <span className="fd-badge fd-private">private</span>
        </div>
      </section>

      <section className="fd-section">
        <h2>폼</h2>
        <div className="fd-card" style={{ maxWidth: 420 }}>
          <label className="fd-field">
            <span className="fd-label">텍스트 입력</span>
            <input className="fd-input" placeholder="placeholder…" />
          </label>
        </div>
      </section>

      <section className="fd-section">
        <h2>알림</h2>
        <div className="fd-stack">
          <div className="fd-alert fd-alert-success">성공 메시지 예시입니다.</div>
          <div className="fd-alert fd-alert-error">오류 메시지 예시입니다.</div>
        </div>
      </section>

      <section className="fd-section">
        <h2>업로드 위젯</h2>
        <div className="fd-card">
          <FileUpload publishableKey="pk_demo" endpoint={DEMO_ENDPOINT} />
        </div>
      </section>
    </>
  )
}
