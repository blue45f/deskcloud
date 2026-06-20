import { AdSlot } from '@addesk/widget'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'

const TOKENS: { name: string; var: string; ink?: string }[] = [
  { name: 'accent', var: '--ax-accent', ink: 'var(--ax-accent-ink)' },
  { name: 'accent-2', var: '--ax-accent-2', ink: '#fff' },
  { name: 'accent-3', var: '--ax-accent-3', ink: '#fff' },
  { name: 'surface', var: '--ax-surface', ink: 'var(--ax-ink)' },
  { name: 'surface-2', var: '--ax-surface-2', ink: 'var(--ax-ink)' },
  { name: 'ink', var: '--ax-ink', ink: '#fff' },
  { name: 'muted', var: '--ax-muted', ink: '#fff' },
  { name: 'danger', var: '--ax-danger', ink: '#fff' },
  { name: 'success', var: '--ax-success', ink: '#fff' },
]

const DEMO_ENDPOINT =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/** /design — 리빙 스타일가이드. 토큰·컴포넌트·위젯을 한 화면에 모아 회귀를 눈으로 잡는다. */
export function DesignPage(): ReactElement {
  useDocumentTitle('디자인 시스템')
  return (
    <>
      <section className="ax-hero" style={{ paddingBottom: 8 }}>
        <h1 className="ax-enter ax-enter-1" style={{ fontSize: 32 }}>
          디자인 <span className="ax-grad-text">시스템</span>
        </h1>
        <p className="ax-enter ax-enter-2">
          AdDesk 어드민·위젯의 토큰과 컴포넌트. 외부 CSS 프레임워크 0, 자체 --ax-* 토큰 + 브랜드
          그라데이션·모션.
        </p>
      </section>

      <section className="ax-section">
        <h2>색상 토큰</h2>
        <div className="ax-grid cols-4">
          {TOKENS.map((t) => (
            <div
              key={t.name}
              className="ax-swatch"
              style={{ background: `var(${t.var})`, color: t.ink ?? 'var(--ax-ink)' }}
            >
              {t.name}
            </div>
          ))}
          <div className="ax-swatch" style={{ background: 'var(--ax-gradient)', color: '#fff' }}>
            gradient
          </div>
        </div>
      </section>

      <section className="ax-section">
        <h2>버튼</h2>
        <div className="ax-card ax-row">
          <button type="button" className="ax-btn ax-btn-primary">
            Primary
          </button>
          <button type="button" className="ax-btn">
            Secondary
          </button>
          <button type="button" className="ax-btn ax-btn-danger">
            Danger
          </button>
          <button type="button" className="ax-btn ax-btn-sm">
            Small
          </button>
          <button type="button" className="ax-btn ax-btn-primary" disabled>
            Disabled
          </button>
        </div>
      </section>

      <section className="ax-section">
        <h2>뱃지</h2>
        <div className="ax-card ax-row">
          <span className="ax-badge">default</span>
          <span className="ax-badge ax-on">active</span>
        </div>
      </section>

      <section className="ax-section">
        <h2>폼</h2>
        <div className="ax-card" style={{ maxWidth: 420 }}>
          <label className="ax-field">
            <span className="ax-label">텍스트 입력</span>
            <input className="ax-input" placeholder="placeholder…" />
          </label>
        </div>
      </section>

      <section className="ax-section">
        <h2>알림</h2>
        <div className="ax-stack">
          <div className="ax-alert ax-alert-success">성공 메시지 예시입니다.</div>
          <div className="ax-alert ax-alert-error">오류 메시지 예시입니다.</div>
        </div>
      </section>

      <section className="ax-section">
        <h2>모션 &amp; 인터랙션</h2>
        <p className="ax-muted" style={{ marginTop: -6, fontSize: 14 }}>
          호버 리프트 카드(상단 그라데이션 라인) · 그라데이션 텍스트 · 발광 CTA. 모두{' '}
          <code className="ax-inline">prefers-reduced-motion</code> 에서 정지/즉시표시로 폴백합니다.
        </p>
        <div className="ax-grid cols-2">
          <div className="ax-card ax-card-i">
            <span className="ax-feature-icon" aria-hidden="true">
              ✨
            </span>
            <h3 style={{ fontSize: 16, margin: '0 0 6px' }}>호버 리프트 카드</h3>
            <p className="ax-muted" style={{ margin: 0, fontSize: 14 }}>
              마우스를 올리면 떠오르며 상단에 브랜드 그라데이션 라인이 그어집니다.
            </p>
          </div>
          <div className="ax-card">
            <p style={{ margin: '0 0 12px', fontWeight: 600 }}>
              발광 <span className="ax-grad-text">그라데이션</span> 버튼
            </p>
            <button type="button" className="ax-btn ax-btn-primary ax-btn-lg">
              무료로 시작하기 →
            </button>
          </div>
        </div>
      </section>

      <section className="ax-section">
        <h2>배너 위젯 (AdSlot)</h2>
        <div className="ax-card" style={{ display: 'flex', justifyContent: 'center' }}>
          <AdSlot slot="sidebar" publishableKey="pk_demo" endpoint={DEMO_ENDPOINT} />
        </div>
      </section>
    </>
  )
}
