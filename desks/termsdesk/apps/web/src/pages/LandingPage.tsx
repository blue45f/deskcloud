import {
  PLAN_IDS,
  PLAN_LABELS,
  PLAN_PRICES_KRW,
  PLAN_TAGLINES,
  formatPlanPrice,
  planLimitBullets,
} from '@termsdesk/shared'
import {
  ArrowRight,
  Code2,
  FileCheck2,
  GitBranch,
  Globe,
  Handshake,
  Lock,
  Moon,
  Server,
  ShieldCheck,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge, StatusPill } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiUrl } from '@/config/urls'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useDemoLogin } from '@/services/auth'

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: GitBranch,
    title: '버전 관리',
    desc: '약관·정책 문서를 불변 버전으로 쌓고, 버전 간 차이를 diff로 비교합니다. 변경 이력은 append-only 감사 로그에 남습니다.',
  },
  {
    icon: Lock,
    title: '변조 방지 게시',
    desc: '게시 시점에 본문을 동결하고 SHA-256 해시를 부여합니다. 게시본은 한 글자도 바뀌지 않으며, API/SDK로 외부 앱에 그대로 전달됩니다.',
  },
  {
    icon: FileCheck2,
    title: '동의 증거',
    desc: '누가 · 어떤 버전(해시)에 · 언제 · 어떻게 동의했는지 변조 방지 영수증으로 기록합니다. 특정 대상의 전체 이력을 즉시 조회·내보내기.',
  },
]

const STEPS = [
  { n: '01', t: '등록', d: '회사가 가진 약관 문안을 정책으로 등록' },
  { n: '02', t: '초안', d: '새 버전 초안을 작성·수정' },
  { n: '03', t: '게시', d: '본문 동결 + 해시 부여, 현재 버전으로 승격' },
  { n: '04', t: '증거', d: 'SDK로 게시본 전달 + 동의 영수증 기록' },
]

const DEV_POINTS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Globe,
    title: '공개 JSON API',
    desc: '게시본을 인증·CORS 제약 없이 JSON으로 제공합니다. 본문·버전·contentHash를 받아 어떤 스택에서든 직접 렌더링하세요.',
  },
  {
    icon: Code2,
    title: '임베드 위젯',
    desc: 'embed.js 한 줄과 data-termsdesk-policy 속성이면 끝. 클릭하면 모달(데스크톱)·바텀시트(모바일)로 게시본이 열립니다.',
  },
  {
    icon: ShieldCheck,
    title: '해시 검증',
    desc: '영수증의 content_hash가 진짜 게시본인지 /verify 엔드포인트로 누구나 다시 확인합니다. 감사자에게 링크만 건네면 됩니다.',
  },
]

function TopNav() {
  const { resolved, toggle } = useTheme()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="TermsDesk 홈">
          <Brand />
        </Link>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="테마 전환">
            {resolved === 'dark' ? (
              <Sun className="size-[1.05rem]" />
            ) : (
              <Moon className="size-[1.05rem]" />
            )}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">로그인</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/app">
              대시보드 <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

export default function LandingPage() {
  usePageMeta({
    path: '/',
    description:
      '약관·정책 문서를 불변 버전으로 관리하고, SHA-256 해시로 변조 방지 게시하며, 누가·언제·어떤 버전에 동의했는지 증거로 남깁니다. SaaS·셀프호스팅.',
  })
  const navigate = useNavigate()
  const demoLogin = useDemoLogin()
  const startDemo = () => demoLogin.mutate(undefined, { onSuccess: () => navigate('/app') })
  // 개발자 CTA — 같은 데모 세션으로 로그인 없이 연동 가이드까지 바로 진입.
  const startDemoGuide = () =>
    demoLogin.mutate(undefined, { onSuccess: () => navigate('/app/guide') })

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-bg">
      <TopNav />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Badge tone="accent" size="sm">
              SaaS · self-hosted
            </Badge>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-text sm:text-5xl">
              약관의 모든 버전을,
              <br />
              <span className="text-accent-strong">증거와 함께.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-text-muted">
              회사가 가진 약관·정책을 등록하고, 버전으로 관리하고, 변조 없이 게시하세요. 누가 어떤
              버전에 언제 동의했는지 증명까지. 클라우드로도, 사내 설치로도.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to="/register">
                  무료로 시작 <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={startDemo}
                loading={demoLogin.isPending}
              >
                로그인 없이 둘러보기
              </Button>
            </div>
            <p className="mt-4 text-xs text-text-subtle">
              약관을 대신 작성하지 않습니다. 버전 관리·게시·증거만 담당합니다.
            </p>
          </div>

          {/* Hero visual: 버전 타임라인 미니 미리보기 */}
          <div className="relative">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">이용약관</span>
                <Badge tone="outline" size="sm">
                  KR
                </Badge>
              </div>
              <ol className="mt-4 space-y-3">
                {[
                  { label: 'v2', status: 'published' as const, cur: true, hash: '67dfa58fad42' },
                  { label: 'v1', status: 'archived' as const, cur: false, hash: 'a1b2c3d4e5f6' },
                ].map((v) => (
                  <li key={v.label} className="flex items-center gap-3">
                    <span
                      className={
                        v.cur
                          ? 'size-2.5 rounded-full bg-accent'
                          : 'size-2.5 rounded-full border-2 border-border-strong'
                      }
                    />
                    <span className="font-mono text-sm font-semibold text-text">{v.label}</span>
                    <StatusPill status={v.status} size="sm" />
                    {v.cur ? (
                      <Badge tone="accent" size="sm">
                        <Lock className="size-3" />
                        현재
                      </Badge>
                    ) : null}
                    <span className="ml-auto font-mono text-xs text-text-subtle">{v.hash}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-lg bg-surface-2/60 p-3 font-mono text-xs text-text-muted">
                GET /api/v1/policies/terms-of-service/current
                <br />
                <span className="text-success">200</span> · contentHash 67dfa58fad42…
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-surface p-5">
              <div className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent-fg">
                <Icon className="size-[1.1rem]" />
              </div>
              <h3 className="mt-3.5 text-base font-semibold text-text">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight text-text">어떻게 동작하나요</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-mono text-sm font-semibold text-accent-strong">{s.n}</span>
                <h3 className="mt-1.5 text-base font-semibold text-text">{s.t}</h3>
                <p className="mt-1 text-sm text-text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deploy */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-6">
            <Server className="size-5 text-accent-strong" />
            <h3 className="mt-3 text-base font-semibold text-text">사내 설치 (self-hosted)</h3>
            <p className="mt-1.5 text-sm text-text-muted">
              민감한 약관·동의 기록을 자체 인프라에 둡니다.{' '}
              <code className="font-mono text-xs">docker compose up</code> 한 번이면
              웹·API·Postgres가 함께 뜹니다. 데이터는 회사 밖으로 나가지 않습니다.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <Badge tone="info" size="sm">
              SaaS
            </Badge>
            <h3 className="mt-3 text-base font-semibold text-text">클라우드 (멀티테넌트)</h3>
            <p className="mt-1.5 text-sm text-text-muted">
              설치 없이 바로 시작. 조직 단위로 격리되며, 같은 코드베이스가 동일하게 동작합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 약관 의뢰 중계 — 전문가와 연결 (플랫폼은 중계, 작성은 전문가) */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge tone="info" size="sm">
                의뢰 중계
              </Badge>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-text">
                약관 작성·검토가 필요하면,
                <br />
                <span className="text-accent-strong">검증된 전문가와 연결.</span>
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-text-muted">
                의뢰를 올리고 제안을 받아 전문가를 고르세요. 완료된 약관은 그대로 버전 관리로 넘어가
                게시·증거까지 이어집니다. 작성은 전문가가, 버전·게시·증거는 TermsDesk가 맡습니다.
              </p>
              <ol className="mt-7 grid gap-4 sm:grid-cols-3">
                {[
                  { n: '01', t: '의뢰 등록', d: '필요한 약관·검토 범위를 올림' },
                  { n: '02', t: '제안 수신', d: '전문가의 제안을 비교·선택' },
                  { n: '03', t: '버전으로', d: '완료 약관을 그대로 버전 관리' },
                ].map((s) => (
                  <li key={s.n}>
                    <span className="font-mono text-sm font-semibold text-accent-strong">
                      {s.n}
                    </span>
                    <h3 className="mt-1.5 text-base font-semibold text-text">{s.t}</h3>
                    <p className="mt-1 text-sm text-text-muted">{s.d}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link to="/app/requests">
                    의뢰 올리기 <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/register">전문가로 등록</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-text-subtle">
                TermsDesk는 의뢰자와 전문가를 잇는 중계만 합니다. 약관 작성·법률 자문은 전문가의
                책임이며, 법률 자문 그 자체는 아닙니다.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">이용약관 작성 의뢰</span>
                <Badge tone="info" size="sm" dot>
                  제안 모집 중
                </Badge>
              </div>
              <ul className="mt-4 space-y-3">
                {[
                  { name: '김 변호사', meta: '제안 12,000원~ · 3일', cur: true },
                  { name: '이 노무사', meta: '제안 18,000원~ · 2일', cur: false },
                ].map((p) => (
                  <li
                    key={p.name}
                    className="flex items-center gap-3 rounded-lg bg-surface-2/60 p-3"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-fg">
                      <Handshake className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-text">{p.name}</span>
                      <p className="text-xs text-text-subtle">{p.meta}</p>
                    </div>
                    {p.cur ? (
                      <Badge tone="accent" size="sm" className="ml-auto">
                        선택
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg bg-surface-2/60 p-3 text-xs text-text-muted">
                선택 후 완료된 약관은 <span className="text-text">버전 v1 초안</span>으로 정책에
                바로 들어갑니다.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 개발자 — 약관을 코드처럼 */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {/* 모바일 단일 트랙에서 코드 카드의 min-content 가 트랙을 565px 로 강제 확장해
            가로 스크롤이 생긴다 — 자식에 min-w-0 을 줘 1fr 안에서 줄바꿈/내부 스크롤되게 한다. */}
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-text">약관을 코드처럼</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
              게시본은 문서이자 API입니다. 인증 없는 공개 JSON과 드롭인 위젯으로 어떤 스택에든
              붙이고, 게시 해시는 누구나 독립적으로 검증합니다.
            </p>
            <ul className="mt-7 space-y-5">
              {DEV_POINTS.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3.5">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-fg">
                    <Icon className="size-[1.1rem]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-muted">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button onClick={startDemoGuide} loading={demoLogin.isPending}>
                데모로 연동 가이드 열기 <ArrowRight className="size-4" />
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/p/termsdesk/terms-of-service">라이브 예시 — 이 사이트의 이용약관</Link>
              </Button>
            </div>
          </div>

          {/* 코드 카드 — INTEGRATION.md 와 동일한 실제 계약만 노출 */}
          <div className="min-w-0 rounded-xl border border-border bg-surface p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text">공개 API · 임베드</span>
              <Badge tone="outline" size="sm">
                무인증
              </Badge>
            </div>
            <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-wide text-text-subtle">
              JSON · 해시 검증
            </p>
            <pre className="mt-1.5 overflow-x-auto rounded-lg bg-surface-2/60 p-3 font-mono text-xs leading-relaxed text-text-muted">
              {`$ curl ${apiUrl('public/acme/policies/terms-of-service')}\n`}
              {'{ "versionLabel": "v2", "contentHash": "67dfa58fad42…", "body": "…" }\n\n'}
              {'$ curl …/policies/terms-of-service/verify?hash=67dfa58fad42…\n'}
              <span className="text-success">{'{ "verified": true, "versionLabel": "v2" }'}</span>
            </pre>
            <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-wide text-text-subtle">
              팝업 위젯 — 스크립트 한 줄
            </p>
            <pre className="mt-1.5 overflow-x-auto rounded-lg bg-surface-2/60 p-3 font-mono text-xs leading-relaxed text-text-muted">
              {`<script src="${apiUrl('public/embed.js')}" data-org="acme" defer></script>\n`}
              {'<a href="#" data-termsdesk-policy="terms-of-service">이용약관</a>'}
            </pre>
            <p className="mt-3 text-xs text-text-subtle">
              연동 가이드에서 내 조직·정책 slug가 채워진 코드를 바로 복사할 수 있습니다 —
              React·바닐라 SDK와 REST로 동의 영수증 기록까지.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing — 클라우드 플랜은 앱 내 설정 > 플랜과 같은 단일 출처(PLAN_LIMITS) */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-text">가격</h2>
            <p className="text-sm text-text-muted">
              클라우드는 팀 규모에 맞게 — 모든 가격은{' '}
              <span className="text-text">데모 기준이며 실제 결제가 없습니다</span>.
            </p>
          </div>
          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            {PLAN_IDS.map((id) => (
              <div
                key={id}
                className={
                  id === 'pro'
                    ? 'relative flex flex-col rounded-xl border-2 border-accent bg-bg p-6 shadow-sm'
                    : 'flex flex-col rounded-xl border border-border bg-bg p-6'
                }
              >
                {id === 'pro' ? (
                  <Badge tone="accent" size="sm" className="absolute -top-2.5 left-6">
                    추천
                  </Badge>
                ) : null}
                <h3 className="text-base font-semibold text-text">{PLAN_LABELS[id]}</h3>
                <p className="mt-1 text-sm text-text-muted">{PLAN_TAGLINES[id]}</p>
                <p className="mt-4 text-2xl font-semibold text-text">
                  {formatPlanPrice(PLAN_PRICES_KRW[id])}
                  <span className="ml-1 text-sm font-normal text-text-subtle">/ 월</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-text-muted">
                  {planLimitBullets(id).map((b) => (
                    <li key={b}>· {b}</li>
                  ))}
                </ul>
                <Button variant={id === 'pro' ? 'primary' : 'secondary'} className="mt-6" asChild>
                  <Link to="/app">{id === 'free' ? '무료로 시작' : '데모로 시작'}</Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-bg p-6 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-semibold text-text">사내 설치 (self-hosted)</h3>
                <p className="mt-1 text-sm text-text-muted">
                  오픈코어 무료 · docker compose 한 번으로 기동 · 데이터가 자체 인프라를 벗어나지
                  않음 · 한도 없음
                </p>
              </div>
              <Button variant="secondary" className="shrink-0" asChild>
                <Link to="/app">데모 둘러보기</Link>
              </Button>
            </div>
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-bg p-6 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-semibold text-text">엔터프라이즈</h3>
                <p className="mt-1 text-sm text-text-muted">
                  SSO · 세분 권한 · 감사 내보내기 · 온프레 설치 지원 · SLA — 별도 협의
                </p>
              </div>
              <Button variant="secondary" className="shrink-0" asChild>
                <Link to="/support/termsdesk?category=partnership">문의하기</Link>
              </Button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-text-subtle">
            약관을 대신 작성하지 않습니다. 버전 · 게시 · 증거 인프라만 제공합니다. 같은 한도를 앱의
            설정 &gt; 플랜에서 바로 업그레이드해 볼 수 있습니다 (데모 — 실제 결제 없음).
          </p>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Brand />
            <nav
              aria-label="약관 및 지원"
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-text-muted"
            >
              <Link
                to="/p/termsdesk/terms-of-service"
                className="transition-colors hover:text-text"
              >
                이용약관
              </Link>
              <Link to="/p/termsdesk/privacy-policy" className="transition-colors hover:text-text">
                개인정보처리방침
              </Link>
              <Link to="/support/termsdesk" className="transition-colors hover:text-text">
                지원 보드
              </Link>
            </nav>
          </div>
          {/* 도그푸딩 — 위 링크는 카탈로그에 게시된 TermsDesk 자신의 약관(/p/termsdesk/*)이다. */}
          <p className="mt-5 text-center text-xs text-text-subtle sm:text-left">
            이 약관도 TermsDesk로 게시·검증됩니다. 약관 버전 관리 시스템. 법률 자문이 아닙니다.{' '}
            <Link
              to="/sitemap"
              className="underline-offset-2 transition-colors hover:text-text-muted hover:underline"
            >
              디자인 시스템
            </Link>
          </p>
        </div>
      </footer>
    </main>
  )
}
