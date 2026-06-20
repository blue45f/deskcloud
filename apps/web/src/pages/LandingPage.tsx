import { PLAN_USER_LIMITS } from '@authdesk/shared'
import { AuthForm } from '@authdesk/widget'
import { Link } from 'react-router-dom'

import type { ReactElement, ReactNode } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'
import { useScrollReveal } from '@/app/useScrollReveal'
import { CopyButton } from '@/components/landing/CopyButton'
import { ChartIcon, EmbedIcon, ShieldIcon, TenantsIcon } from '@/components/landing/icons'
import { PlanEstimator } from '@/components/landing/PlanEstimator'
import { SnippetTabs } from '@/components/landing/SnippetTabs'
import { installSnippet, reactSnippet, sdkSnippet, vanillaSnippet } from '@/utils/embed'

const DEMO_ENDPOINT =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/** 보조 기능 카드. 첫 카드는 비대칭 lead 로 별도 렌더한다. */
const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <TenantsIcon />,
    title: '멀티테넌트 사용자 풀',
    body: '각 테넌트는 자기만의 end-user 풀을 가진다. 이메일은 테넌트별 유니크 — 다른 앱과 섞이지 않습니다.',
  },
  {
    icon: <ShieldIcon />,
    title: '안전한 비밀번호·세션',
    body: 'scrypt(node:crypto) 비밀번호 해시 + 테넌트별 비밀로 서명한 JWT 세션. 로그아웃 시 서버에서 폐기합니다.',
  },
  {
    icon: <ChartIcon />,
    title: '어드민 통계',
    body: 'secret(sk_) 키로 사용자 목록·가입 추이(7d/30d)·로그인 수·verified 비율을 한눈에 봅니다.',
  },
]

/** 신뢰 띠 수치 — 플랜 한도는 shared 가 단일 소스이므로 가격표와 절대 어긋나지 않는다. */
const PRO_LIMIT_LABEL = `${(PLAN_USER_LIMITS.pro / 1000).toLocaleString('en-US')}K`

const TRUST = [
  { num: '1', label: '의존성 (react 뿐)' },
  { num: `${PRO_LIMIT_LABEL}+`, label: 'Pro 플랜 사용자' },
  { num: 'scrypt', label: '비밀번호 해시' },
  { num: '< 1min', label: '임베드 설치' },
]

const EXAMPLE_ENDPOINT = 'https://auth.example.com'

export function LandingPage(): ReactElement {
  useDocumentTitle('임베드 로그인/인증')
  const revealRef = useScrollReveal<HTMLDivElement>()

  const snippets = [
    { id: 'install', label: '설치', code: installSnippet() },
    {
      id: 'react',
      label: 'React',
      code: reactSnippet({ publishableKey: 'pk_live_…', endpoint: EXAMPLE_ENDPOINT }),
    },
    {
      id: 'vanilla',
      label: '바닐라 JS',
      code: vanillaSnippet({ publishableKey: 'pk_live_…', endpoint: EXAMPLE_ENDPOINT }),
    },
    {
      id: 'sdk',
      label: 'SDK',
      code: sdkSnippet({ publishableKey: 'pk_live_…', endpoint: EXAMPLE_ENDPOINT }),
    },
  ]

  return (
    <div ref={revealRef}>
      {/* ── 히어로 ─────────────────────────────────────────── */}
      <section className="ad-hero-wrap">
        <div className="ad-aurora" aria-hidden="true" />
        <div className="ad-hero">
          <span className="ad-pill" data-reveal>
            <span className="ad-pill-tag">NEW</span>
            <span className="ad-pill-dot" aria-hidden="true" />
            드롭인 인증 · 의존성은 react 뿐
          </span>

          <h1 data-reveal style={{ '--ad-reveal-delay': '60ms' } as React.CSSProperties}>
            드롭인 로그인, <span className="ad-hero-accent">한 줄로</span> 끝.
          </h1>

          <p data-reveal style={{ '--ad-reveal-delay': '120ms' } as React.CSSProperties}>
            AuthDesk 는 형제·외부 앱에 붙는 멀티테넌트 인증(auth-as-a-service) 모듈입니다.
            publishable 키로 가입·로그인 폼을 임베드하고, secret 키로 사용자를 관리하세요.
          </p>

          <div
            className="ad-hero-cta"
            data-reveal
            style={{ '--ad-reveal-delay': '180ms' } as React.CSSProperties}
          >
            <Link to="/signup" className="ad-btn ad-btn-primary ad-btn-lg">
              무료로 시작하기
            </Link>
            <a href="#try" className="ad-btn ad-btn-lg ad-btn-ghost-arrow">
              위젯 체험하기 <span aria-hidden="true">↓</span>
            </a>
          </div>

          {/* "한 줄로 끝" 터미널 카드 */}
          <div
            className="ad-hero-term"
            data-reveal
            style={{ '--ad-reveal-delay': '240ms' } as React.CSSProperties}
          >
            <div className="ad-term-bar" aria-hidden="true">
              <span className="ad-term-dot" />
              <span className="ad-term-dot" />
              <span className="ad-term-dot" />
              <span className="ad-term-title">app.tsx</span>
            </div>
            <pre className="ad-term-body">
              <span className="ad-term-comment">{'// 가입·로그인 폼, 끝.'}</span>
              {'\n'}
              {'<'}
              <span className="ad-hero-accent">AuthForm</span> publishableKey={'"pk_live_…"'} {'/>'}
            </pre>
          </div>

          {/* 신뢰 띠 — 진짜 플랜 데이터 기반 */}
          <div
            className="ad-trust"
            data-reveal
            style={{ '--ad-reveal-delay': '300ms' } as React.CSSProperties}
          >
            {TRUST.map((t) => (
              <div key={t.label} className="ad-trust-item">
                <div className="ad-trust-num">{t.num}</div>
                <div className="ad-trust-label">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 기능 쇼케이스 ──────────────────────────────────── */}
      <section className="ad-section" aria-labelledby="features-heading">
        <div className="ad-section-center" data-reveal>
          <h2 id="features-heading">붙이는 데 필요한 전부, 그 이상은 없게.</h2>
          <p>임베드 폼부터 어드민 통계까지 — 인증에 필요한 것만 단단하게 담았습니다.</p>
        </div>

        <div className="ad-features">
          {/* lead 카드(비대칭) — 임베드 폼 + 라이브 미리보기 */}
          <article
            className="ad-feature is-lead"
            data-reveal
            style={{ '--ad-reveal-delay': '40ms' } as React.CSSProperties}
          >
            <div>
              <span className="ad-feature-ico">
                <EmbedIcon />
              </span>
              <h3>임베드 로그인·가입 폼</h3>
              <p>
                로그인·가입 탭 전환 + 인라인 검증을 갖춘 폼을 React 컴포넌트 한 줄, 또는{' '}
                <code className="ad-inline">&lt;script&gt;</code> 한 줄(바닐라 IIFE)로 붙입니다.
                accent 색만 넘기면 브랜드에 맞춰집니다.
              </p>
            </div>
            <div className="ad-feature-figure" aria-hidden="true">
              <pre
                className="ad-code"
                style={{ background: 'transparent', border: 0, fontSize: 12.5, padding: 0 }}
              >
                {'<AuthForm\n  publishableKey="pk_…"\n  endpoint="…/api"\n  accent="#2f5fe0"\n/>'}
              </pre>
            </div>
          </article>

          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className="ad-feature"
              data-reveal
              style={{ '--ad-reveal-delay': `${80 + i * 70}ms` } as React.CSSProperties}
            >
              <span className="ad-feature-ico">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── 라이브 데모(브라우저 프레임) ───────────────────── */}
      <section className="ad-section" id="try" aria-labelledby="try-heading">
        <div className="ad-section-center" data-reveal>
          <h2 id="try-heading">지금 바로 체험</h2>
          <p>
            아래는 실제 <code className="ad-inline">&lt;AuthForm&gt;</code> 위젯입니다(데모 테넌트{' '}
            <code className="ad-inline">pk_demo</code>). 로컬 API가 떠 있으면 데모 사용자{' '}
            <code className="ad-inline">ada@demo.test</code> /{' '}
            <code className="ad-inline">Password123!</code> 로 로그인됩니다.
          </p>
        </div>

        <div className="ad-browser" data-reveal>
          <div className="ad-browser-bar" aria-hidden="true">
            <span className="ad-term-dot" />
            <span className="ad-term-dot" />
            <span className="ad-term-dot" />
            <span className="ad-browser-url">app.example.com/login</span>
          </div>
          <div className="ad-browser-body">
            <AuthForm
              publishableKey="pk_demo"
              endpoint={DEMO_ENDPOINT}
              storage="memory"
              onAuthenticated={(r) => console.info('[landing] authenticated', r.user.email)}
            />
          </div>
        </div>
      </section>

      {/* ── 플랜 추정기(인터랙티브 데이터 어포던스) ────────── */}
      <section className="ad-section" aria-labelledby="estimate-heading">
        <div className="ad-section-center" data-reveal>
          <h2 id="estimate-heading">어떤 플랜이 맞을까요?</h2>
          <p>예상 사용자 수를 옮겨 보세요. 플랜 한도는 API가 단일 소스입니다.</p>
        </div>
        <div data-reveal>
          <PlanEstimator />
        </div>
      </section>

      {/* ── 설치(스니펫 탭 + 복사) ────────────────────────── */}
      <section className="ad-section" aria-labelledby="install-heading">
        <div className="ad-section-center" data-reveal>
          <h2 id="install-heading">설치는 한 번이면 됩니다</h2>
          <p>스택을 고르고, 코드를 복사해 붙여넣으세요. 키만 바꾸면 끝입니다.</p>
        </div>
        <div data-reveal>
          <SnippetTabs snippets={snippets} ariaLabel="임베드 방식 선택" />
        </div>
      </section>

      {/* ── 마무리 CTA ─────────────────────────────────────── */}
      <section className="ad-section" aria-labelledby="cta-heading">
        <div className="ad-cta-banner" data-reveal>
          <h2 id="cta-heading">5분이면 첫 사용자를 받습니다.</h2>
          <p>테넌트를 만들면 pk_/sk_ 키쌍이 바로 발급됩니다. 카드도, 설정도 필요 없습니다.</p>
          <div className="ad-hero-cta">
            <Link to="/signup" className="ad-btn ad-btn-lg ad-btn-on-accent">
              무료로 시작하기
            </Link>
            <Link to="/pricing" className="ad-btn ad-btn-lg ad-btn-on-accent-ghost">
              요금제 보기
            </Link>
          </div>
        </div>

        {/* 빠른 복사: npm 설치 한 줄 */}
        <div className="ad-codeblock" data-reveal style={{ marginTop: 16 }}>
          <CopyButton value="npm i @authdesk/widget" label="설치 명령" />
          <pre className="ad-code ad-code-tall">npm i @authdesk/widget</pre>
        </div>
      </section>
    </div>
  )
}
