import { AdSlot } from '@addesk/widget'
import { Link } from 'react-router-dom'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'
import { useScrollReveal } from '@/app/useScrollReveal'
import { CopyButton } from '@/components/CopyButton'
import { installSnippet, reactSnippet } from '@/utils/embed'

const FEATURES = [
  {
    icon: '⚡',
    title: '임베드 배너 위젯',
    body: '<AdSlot slot publishableKey endpoint/> 한 줄. React 컴포넌트 또는 <script> IIFE. 의존성은 react 뿐.',
  },
  {
    icon: '🎯',
    title: '가중치 서빙',
    body: '슬롯의 활성 크리에이티브를 weight 비례 확률로 선택. 캠페인 상태·기간으로 서빙 여부를 제어.',
  },
  {
    icon: '📈',
    title: '노출·클릭 추적',
    body: '서빙·노출·클릭을 자동 집계. 캠페인별 CTR 통계를 대시보드에서 본다.',
  },
  {
    icon: '🔑',
    title: '멀티테넌트 키',
    body: 'publishable(pk_)로 브라우저에서 서빙·추적, secret(sk_)로 서버에서 CRUD·통계. SHA-256 해시 저장.',
  },
]

const STEPS = [
  {
    n: '01',
    title: '가입하고 키 발급',
    body: 'pk_/sk_ 키쌍을 즉시 받습니다. 카드 등록 없이 무료로 시작.',
  },
  {
    n: '02',
    title: '슬롯에 위젯 임베드',
    body: '<AdSlot/> 한 줄을 붙이면 활성 크리에이티브가 가중치대로 노출됩니다.',
  },
  {
    n: '03',
    title: '성과 확인',
    body: '노출·클릭·CTR이 대시보드에 실시간 집계됩니다. Pro로 무제한 확장.',
  },
]

const DEMO_ENDPOINT =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

const INSTALL_SNIPPET = installSnippet()
const REACT_SNIPPET = reactSnippet({
  publishableKey: 'pk_…',
  endpoint: 'https://ads.example.com',
  slot: 'sidebar',
})

export function LandingPage(): ReactElement {
  useDocumentTitle('임베드 배너·광고 서빙')
  const revealRef = useScrollReveal<HTMLDivElement>()

  return (
    <div ref={revealRef}>
      <div className="ax-hero-stage">
        <div className="ax-hero-aurora" aria-hidden="true" />
        <div className="ax-hero-grid" aria-hidden="true" />
        <span className="ax-orb ax-orb-a" aria-hidden="true" />
        <span className="ax-orb ax-orb-b" aria-hidden="true" />

        <section className="ax-hero">
          <span className="ax-hero-eyebrow ax-enter ax-enter-1">
            <span className="ax-dot" aria-hidden="true" />
            멀티테넌트 배너·광고 서빙 모듈
          </span>
          <h1 className="ax-enter ax-enter-2">
            임베드 배너 광고,
            <br />
            <span className="ax-grad-text">한 줄로 끝.</span>
          </h1>
          <p className="ax-enter ax-enter-3">
            AdDesk 는 형제·외부 앱에 붙는 멀티테넌트 배너·광고 서빙 모듈입니다. publishable 키로
            슬롯에 배너를 띄우고, secret 키로 캠페인·크리에이티브·슬롯·통계를 관리하세요.
          </p>
          <div className="ax-row ax-enter ax-enter-3" style={{ justifyContent: 'center' }}>
            <Link to="/signup" className="ax-btn ax-btn-primary ax-btn-lg">
              무료로 시작하기 →
            </Link>
            <Link to="/pricing" className="ax-btn ax-btn-lg">
              요금제 보기
            </Link>
          </div>
          <div className="ax-hero-stats ax-enter ax-enter-4">
            <span>
              <b>1줄</b>
              임베드 설치
            </span>
            <span>
              <b>react</b>
              유일한 의존성
            </span>
            <span>
              <b>pk_ / sk_</b>
              멀티테넌트 키
            </span>
            <span>
              <b>실시간</b>
              CTR 집계
            </span>
          </div>
        </section>
      </div>

      <section className="ax-section" aria-labelledby="features-heading">
        <h2 id="features-heading" data-reveal className="ax-reveal">
          왜 AdDesk 인가
        </h2>
        <div className="ax-grid cols-2">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              data-reveal
              className="ax-card ax-card-i ax-reveal"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <span className="ax-feature-icon" aria-hidden="true">
                {f.icon}
              </span>
              <h3 style={{ fontSize: 17, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                {f.title}
              </h3>
              <p className="ax-muted" style={{ margin: 0, fontSize: 14 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="ax-section" aria-labelledby="steps-heading">
        <h2 id="steps-heading" data-reveal className="ax-reveal">
          3단계로 라이브
        </h2>
        <div className="ax-grid cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              data-reveal
              className="ax-card ax-card-i ax-reveal"
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <span
                className="ax-grad-text"
                style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}
                aria-hidden="true"
              >
                {s.n}
              </span>
              <h3 style={{ fontSize: 16, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>
                {s.title}
              </h3>
              <p className="ax-muted" style={{ margin: 0, fontSize: 14 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="ax-section" aria-labelledby="demo-heading">
        <h2 id="demo-heading" data-reveal className="ax-reveal">
          지금 바로 체험
        </h2>
        <p className="ax-muted ax-reveal" data-reveal style={{ marginTop: -6 }}>
          아래는 실제 <code className="ax-inline">&lt;AdSlot&gt;</code> 위젯입니다(데모 테넌트{' '}
          <code className="ax-inline">pk_demo</code>, 슬롯{' '}
          <code className="ax-inline">sidebar</code>
          ). 로컬 API가 떠 있으면 배너가 노출됩니다.
        </p>
        <div
          data-reveal
          className="ax-card ax-reveal"
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <AdSlot slot="sidebar" publishableKey="pk_demo" endpoint={DEMO_ENDPOINT} />
        </div>
      </section>

      <section className="ax-section" aria-labelledby="install-heading">
        <h2 id="install-heading" data-reveal className="ax-reveal">
          설치
        </h2>
        <div data-reveal className="ax-reveal ax-code-wrap">
          <pre className="ax-code">{INSTALL_SNIPPET}</pre>
          <CopyButton value={INSTALL_SNIPPET} label="설치 명령 복사" />
        </div>
        <div data-reveal className="ax-reveal ax-code-wrap" style={{ marginTop: 12 }}>
          <pre className="ax-code">{REACT_SNIPPET}</pre>
          <CopyButton value={REACT_SNIPPET} label="React 스니펫 복사" />
        </div>
      </section>

      <section className="ax-section">
        <div data-reveal className="ax-reveal ax-cta-band">
          <h2>오늘 첫 배너를 띄워보세요</h2>
          <p>카드 등록 없이 무료로 시작하고, 트래픽이 커지면 Pro 로 무제한 확장하세요.</p>
          <div className="ax-row" style={{ justifyContent: 'center', marginTop: 22 }}>
            <Link to="/signup" className="ax-btn ax-btn-lg ax-btn-on-accent">
              무료로 시작하기 →
            </Link>
            <Link
              to="/support"
              className="ax-btn ax-btn-lg"
              style={{
                background: 'transparent',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.55)',
              }}
            >
              문의하기
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
