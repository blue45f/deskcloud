import { FileUpload } from '@filedesk/widget'
import { Link } from 'react-router-dom'

import type { CodeTab } from '@/components/CodeBlock'
import type { ComponentType, ReactElement, SVGProps } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'
import { CodeBlock } from '@/components/CodeBlock'
import { IconKey, IconShield, IconSwap, IconUpload } from '@/components/icons'
import { OperationsPanel } from '@/components/OperationsPanel'
import { Reveal } from '@/components/Reveal'
import { installSnippet, reactSnippet, vanillaSnippet } from '@/utils/embed'

interface Feature {
  title: string
  body: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

const FEATURES: Feature[] = [
  {
    title: '임베드 업로드 위젯',
    body: '드래그-드롭 + 진행률. React 컴포넌트 또는 <script> 한 줄(바닐라 IIFE). 의존성은 react 뿐.',
    Icon: IconUpload,
  },
  {
    title: '멀티테넌트 키',
    body: 'publishable(pk_)로 브라우저에서 업로드, secret(sk_)로 서버에서 목록·통계·삭제. scrypt 해시 저장.',
    Icon: IconKey,
  },
  {
    title: '접근 제어',
    body: 'public 파일은 URL 직접 서빙, private 은 secret 키 또는 한시 서명 토큰으로만 접근.',
    Icon: IconShield,
  },
  {
    title: '스토리지 어댑터',
    body: 'v1 기본은 Postgres-bytea(설정 0). 프로덕션은 S3/R2 로 스왑(DESK_STORAGE_DRIVER=s3).',
    Icon: IconSwap,
  },
]

const STEPS = [
  {
    title: '가입하고 키 발급',
    body: '셀프 가입 즉시 publishable(pk_)·secret(sk_) 키쌍을 받습니다. 신용카드 불필요.',
  },
  {
    title: '위젯 임베드',
    body: 'React 컴포넌트 한 줄 또는 <script> 한 줄. pk_ 키로 브라우저에서 바로 업로드.',
  },
  {
    title: '서버에서 관리',
    body: 'sk_ 키로 파일 목록·통계 조회, 삭제, 서명 URL 발급. public/private 접근까지 제어.',
  },
]

const TRUST = [
  { num: '1줄', label: '임베드 코드' },
  { num: '0', label: '외부 CSS 의존성' },
  { num: 'pk_ / sk_', label: '멀티테넌트 키' },
  { num: 'S3 · R2', label: '프로덕션 스왑' },
]

const DEMO_ENDPOINT =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

const EMBED_TABS: CodeTab[] = [
  {
    id: 'react',
    label: 'React',
    code: reactSnippet({ publishableKey: 'pk_…', endpoint: 'https://files.example.com' }),
  },
  {
    id: 'vanilla',
    label: 'HTML',
    code: vanillaSnippet({ publishableKey: 'pk_…', endpoint: 'https://files.example.com' }),
  },
  { id: 'install', label: 'npm', code: installSnippet() },
]

export function LandingPage(): ReactElement {
  useDocumentTitle('임베드 파일 업로드/스토리지')
  return (
    <>
      <section className="fd-hero">
        <div className="fd-hero-decor" aria-hidden="true">
          <div className="fd-hero-grid" />
          <div className="fd-hero-blob fd-hero-blob-1" />
          <div className="fd-hero-blob fd-hero-blob-2" />
          <div className="fd-hero-blob fd-hero-blob-3" />
        </div>

        <p
          className="fd-hero-eyebrow fd-enter"
          style={{ '--fd-enter-i': 0 } as React.CSSProperties}
        >
          <span className="fd-pill">NEW</span>
          파일 업로드를 한 줄로 — 멀티테넌트 스토리지 모듈
        </p>

        <h1 className="fd-enter" style={{ '--fd-enter-i': 1 } as React.CSSProperties}>
          임베드 파일 업로드,
          <br />
          <span className="fd-hero-em">한 줄로</span> 끝.
        </h1>

        <p className="fd-enter" style={{ '--fd-enter-i': 2 } as React.CSSProperties}>
          FileDesk 는 형제·외부 앱에 붙는 멀티테넌트 파일 업로드/스토리지 모듈입니다. publishable
          키로 위젯을 임베드하고, secret 키로 파일을 관리하세요.
        </p>

        <div
          className="fd-row fd-enter"
          style={{ justifyContent: 'center', '--fd-enter-i': 3 } as React.CSSProperties}
        >
          <Link to="/signup" className="fd-btn fd-btn-primary fd-btn-lg">
            무료로 시작하기
            <span className="fd-btn-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link to="/pricing" className="fd-btn fd-btn-lg">
            요금제 보기
          </Link>
        </div>

        <p
          className="fd-muted fd-enter"
          style={{ fontSize: 13, margin: '14px 0 0', '--fd-enter-i': 4 } as React.CSSProperties}
        >
          신용카드 불필요 · 가입 즉시 pk_/sk_ 키 발급 · 아래에서 바로 체험
        </p>

        <div
          className="fd-trust fd-enter"
          style={{ '--fd-enter-i': 5 } as React.CSSProperties}
          aria-label="핵심 특징"
        >
          {TRUST.map((t) => (
            <div key={t.label} className="fd-trust-item">
              <div className="fd-trust-num">{t.num}</div>
              <p className="fd-trust-label">{t.label}</p>
            </div>
          ))}
        </div>
      </section>

      <OperationsPanel />

      <section className="fd-section" aria-labelledby="fd-features-heading">
        <Reveal className="fd-section-head fd-center">
          <h2 id="fd-features-heading">붙이면 바로 동작하는 스토리지</h2>
          <p>업로드 위젯부터 접근 제어·스토리지 스왑까지, 파일을 다루는 데 필요한 전부.</p>
        </Reveal>
        <div className="fd-grid cols-2" style={{ marginTop: 22 }}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} index={i} className="fd-card fd-card-hover fd-feature">
              <span className="fd-feature-icon" aria-hidden="true">
                <f.Icon />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="fd-section" aria-labelledby="fd-steps-heading">
        <Reveal className="fd-section-head fd-center">
          <h2 id="fd-steps-heading">3단계면 충분합니다</h2>
          <p>가입부터 운영까지, 가장 빠른 경로.</p>
        </Reveal>
        <ol className="fd-steps" style={{ marginTop: 22, listStyle: 'none', padding: 0 }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.title} as="li" index={i} className="fd-card fd-step">
              <span className="fd-step-num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="fd-section" aria-labelledby="fd-demo-heading">
        <Reveal className="fd-section-head fd-center">
          <h2 id="fd-demo-heading">지금 바로 체험</h2>
          <p>
            아래는 실제 <code className="fd-inline">&lt;FileUpload&gt;</code> 위젯입니다(데모 테넌트{' '}
            <code className="fd-inline">pk_demo</code>). 로컬 API가 떠 있으면 업로드가 동작합니다.
          </p>
        </Reveal>
        <Reveal className="fd-card fd-card-hover">
          <FileUpload
            publishableKey="pk_demo"
            endpoint={DEMO_ENDPOINT}
            onUploaded={(f) => console.info('[landing] uploaded', f.key, f.url)}
          />
        </Reveal>
      </section>

      <section className="fd-section" aria-labelledby="fd-install-heading">
        <Reveal className="fd-section-head">
          <h2 id="fd-install-heading">설치</h2>
          <p>원하는 방식을 고르세요 — React, 바닐라 HTML, 또는 npm 설치.</p>
        </Reveal>
        <Reveal style={{ marginTop: 18 }}>
          <CodeBlock tabs={EMBED_TABS} copyLabel="임베드 스니펫" />
        </Reveal>
      </section>

      <section className="fd-section">
        <Reveal className="fd-cta-band">
          <h2>오늘 첫 파일을 올려 보세요</h2>
          <p>가입 즉시 키가 발급되고, 몇 분이면 업로드가 동작합니다.</p>
          <div className="fd-row" style={{ justifyContent: 'center' }}>
            <Link to="/signup" className="fd-btn fd-btn-primary fd-btn-lg">
              무료로 시작하기
              <span className="fd-btn-arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link to="/support" className="fd-btn fd-btn-lg">
              문의하기
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
