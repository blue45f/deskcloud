/**
 * 위젯 데모 진입점 — 4개 위젯을 한 화면에 띄운다. 소스(src/*.tsx)를 직접 import 하므로
 * 빌드 산출물 없이 동작한다. 컨트롤(pk/endpoint/subjectId/accent)을 바꾸면 재마운트.
 */
import { StrictMode, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import {
  ReviewForm,
  ReviewList,
  ReviewStars,
  TestimonialWall,
} from '../src/react'

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [cfg, setCfg] = useState({
    publishableKey: 'pk_demo',
    endpoint: 'http://localhost:4099',
    subjectId: 'pro-plan',
    accent: '#2f5fe0',
    nonce: 0,
  })

  const sync = () =>
    setCfg((c) => ({
      publishableKey: readInput('pk') || 'pk_demo',
      endpoint: readInput('endpoint') || 'http://localhost:4099',
      subjectId: readInput('subjectId') || 'pro-plan',
      accent: readInput('accent') || '#2f5fe0',
      nonce: c.nonce + 1,
    }))

  if (typeof window !== 'undefined' && !(window as { __rdBound?: boolean }).__rdBound) {
    ;(window as { __rdBound?: boolean }).__rdBound = true
    for (const id of ['pk', 'endpoint', 'subjectId', 'accent']) {
      document.getElementById(id)?.addEventListener('change', sync)
    }
    const ep = document.getElementById('ep-label')
    if (ep) ep.textContent = cfg.endpoint
  }

  const common = {
    publishableKey: cfg.publishableKey,
    endpoint: cfg.endpoint,
    accent: cfg.accent,
  }

  return (
    <div key={cfg.nonce}>
      <section className="demo">
        <h2>1. ReviewStars (배지)</h2>
        <div className="inline-row">
          제품 제목 옆 인라인:
          <ReviewStars {...common} subjectId={cfg.subjectId} size="sm" />
        </div>
        <div className="inline-row" style={{ marginTop: 12 }}>
          큰 사이즈:
          <ReviewStars {...common} subjectId={cfg.subjectId} size="lg" />
        </div>
      </section>

      <section className="demo">
        <h2>2. ReviewList (목록 + 분포 + 집계)</h2>
        <ReviewList {...common} subjectId={cfg.subjectId} />
      </section>

      <section className="demo">
        <h2>3. ReviewForm (제출)</h2>
        <ReviewForm
          {...common}
          subjectId={cfg.subjectId}
          subjectLabel="Pro 플랜"
          collectEmail
          onSubmitted={(r) => console.info('[demo] submitted', r)}
        />
      </section>

      <section className="demo">
        <h2>4. TestimonialWall (후기 그리드)</h2>
        <TestimonialWall {...common} />
      </section>
    </div>
  )
}

const host = document.getElementById('app') ?? document.body
createRoot(host).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
