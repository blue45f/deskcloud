import {
  ArrowRight,
  Gauge,
  KeyRound,
  Layers,
  Moon,
  Radio,
  Send,
  ShieldCheck,
  Sun,
  Users,
  Webhook,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuthStore } from '@/app/authStore'
import { useTheme } from '@/app/ThemeContext'
import { LiveWire } from '@/components/feature/LiveWire'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useReveal } from '@/hooks/useReveal'
import { cn } from '@/utils/cn'

const FEATURES = [
  {
    icon: Radio,
    title: '채널 pub/sub',
    body: '테넌트별로 격리된 채널을 구독하고 발행합니다. 브라우저는 publishable 키로, 서버는 secret 키로.',
  },
  {
    icon: Users,
    title: 'Presence',
    body: '채널에 누가 있는지 실시간으로. 참여·이탈이 즉시 반영되고, <PresenceBar> 위젯 한 줄이면 끝.',
  },
  {
    icon: Send,
    title: '서버 publish',
    body: 'REST 한 번 또는 SDK 한 줄로 채널에 이벤트를 브로드캐스트. 모든 구독 소켓에 즉시 전달됩니다.',
  },
  {
    icon: Layers,
    title: '메시지 히스토리',
    body: '채널당 최근 N개 메시지를 저장(선택). 새로 들어온 클라이언트가 맥락을 바로 따라잡습니다.',
  },
  {
    icon: ShieldCheck,
    title: 'Origin allowlist',
    body: '테넌트별 CORS/Origin 허용목록으로 WS 핸드셰이크를 보호. secret 키는 해시로만 저장합니다.',
  },
  {
    icon: Zap,
    title: '게이트웨이 친화 경로',
    body: 'socket.io 를 /realtime 에 정확 매칭으로 마운트 — 프록시·게이트웨이 뒤에서도 핸드셰이크가 깨지지 않습니다.',
  },
]

const STEPS = [
  { n: '01', title: '가입', body: '프로젝트 이름만 입력하면 pk·sk 키 한 쌍을 즉시 발급합니다.' },
  {
    n: '02',
    title: '붙이기',
    body: '브라우저엔 PresenceBar/SDK, 서버엔 publisher 한 줄. CORS Origin 만 등록하면 됩니다.',
  },
  {
    n: '03',
    title: '운영',
    body: '대시보드에서 라이브 채널·연결·presence 를 보고, 테스트 이벤트를 쏘고, 사용량을 확인합니다.',
  },
]

const METRICS = [
  { label: '전달 지연', value: '<100', unit: 'ms', hint: '구독자까지 라운드트립' },
  { label: '키 발급', value: '1', unit: '쌍', hint: 'pk·sk, 가입 즉시' },
  { label: '직접 운영 소켓', value: '0', unit: '대', hint: '인프라 없음' },
  { label: '시작 비용', value: '₩0', unit: '', hint: 'Free 플랜·카드 불필요' },
]

const SNIPPETS = {
  server: {
    label: '서버 (publish)',
    code: `import { createPublisher } from '@realtimedesk/sdk/server'

const pub = createPublisher({
  secretKey: process.env.REALTIMEDESK_SECRET_KEY,
  endpoint: 'https://realtime.example.com',
})

// 채널 구독자 전원에게 즉시 전달 + 히스토리 저장
await pub.publish('room:42', 'message', { user: 'kim', text: 'hi' })`,
  },
  client: {
    label: '브라우저 (subscribe)',
    code: `import { createRealtimeClient } from '@realtimedesk/sdk'

const rt = createRealtimeClient({
  publishableKey: 'pk_…',
  endpoint: 'https://realtime.example.com',
})

await rt.connect()
rt.subscribe('room:42', (msg) => console.log(msg))
rt.presence('room:42', (peers) => render(peers)) // 누가 접속 중인지`,
  },
} as const

type SnippetKey = keyof typeof SNIPPETS

export default function LandingPage() {
  useDocumentTitle()
  const { resolved, toggle } = useTheme()
  const isAuthed = useAuthStore((s) => s.isAuthed)
  const revealRef = useReveal<HTMLElement>()
  const [tab, setTab] = useState<SnippetKey>('server')

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/sitemap">사이트맵</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/support">문의</Link>
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={toggle}
              aria-label={resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {resolved === 'dark' ? (
                <Sun className="size-[1.05rem]" />
              ) : (
                <Moon className="size-[1.05rem]" />
              )}
            </Button>
            {/* 통합 회원 로그인(Firebase 이메일/게스트) — 테넌트 콘솔(sk_) 진입과 별개. */}
            <MemberAuthControl />
            {isAuthed ? (
              <Button asChild size="sm">
                <Link to="/app">대시보드</Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/login">시작하기</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none" ref={revealRef}>
        {/* 히어로 — 좌: 카피·CTA, 우: 라이브 와이어 콘솔. 배경: 격자 + 시그널 글로우. */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="grid-texture absolute inset-0" aria-hidden />
          <span
            className="signal-glow top-[-6rem] right-[-4rem] size-[28rem] sm:size-[34rem]"
            aria-hidden
          />
          <span
            className="signal-glow bottom-[-10rem] left-[-6rem] size-[24rem] [animation-delay:-4s]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-20 lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
            <div className="max-w-2xl">
              <span className="hero-enter inline-block" style={{ '--i': 0 } as React.CSSProperties}>
                <Badge tone="accent" size="sm">
                  <span className="relative mr-1 inline-flex size-1.5">
                    <span className="absolute inline-flex size-full animate-[pulse-ring_1.8s_ease-out_infinite] rounded-full bg-current opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-current" />
                  </span>
                  실시간 as a service
                </Badge>
              </span>
              <h1
                className="hero-enter mt-4 text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-tight text-balance text-text"
                style={{ '--i': 1 } as React.CSSProperties}
              >
                WebSocket pub/sub·presence를
                <span className="text-accent-strong"> 키 한 쌍</span>으로
              </h1>
              <p
                className="hero-enter mt-5 max-w-xl text-pretty text-text-muted sm:text-lg"
                style={{ '--i': 2 } as React.CSSProperties}
              >
                가입하면 publishable·secret 키를 발급합니다. 브라우저는 채널을 구독하고 누가
                접속했는지 보고, 서버는 한 줄로 이벤트를 발행하세요. 인프라·소켓 서버를 직접 운영할
                필요가 없습니다.
              </p>
              <div
                className="hero-enter mt-8 flex flex-col gap-3 sm:flex-row"
                style={{ '--i': 3 } as React.CSSProperties}
              >
                <Button asChild size="lg" className="group">
                  <Link to="/login">
                    무료로 시작하기
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/sitemap">사이트맵 보기</Link>
                </Button>
              </div>
              <p
                className="hero-enter mt-4 flex items-center gap-1.5 text-xs text-text-subtle"
                style={{ '--i': 4 } as React.CSSProperties}
              >
                <KeyRound className="size-3.5" aria-hidden />
                신용카드 불필요 · Free 플랜 즉시 사용 · SaaS·셀프호스팅
              </p>
            </div>

            <div
              className="hero-enter w-full lg:justify-self-end"
              style={{ '--i': 3 } as React.CSSProperties}
            >
              <LiveWire className="mx-auto w-full max-w-md" />
            </div>
          </div>
        </section>

        {/* 지표 밴드 — 경쟁 서비스 대비 핵심 수치(라이브 데모 아래 신뢰 신호) */}
        <section className="border-b border-border bg-surface/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-border px-4 py-0 sm:px-6 lg:grid-cols-4 lg:divide-y-0">
            {METRICS.map((m, i) => (
              <div
                key={m.label}
                data-reveal-target
                className="px-2 py-8 text-center sm:px-4"
                style={{ '--i': i } as React.CSSProperties}
              >
                <p className="text-3xl font-semibold tracking-tight tabular-nums text-text sm:text-4xl">
                  {m.value}
                  {m.unit ? (
                    <span className="ml-0.5 text-base font-medium text-accent-strong">
                      {m.unit}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1.5 text-sm font-medium text-text">{m.label}</p>
                <p className="mt-0.5 text-xs text-text-subtle">{m.hint}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 기능 그리드 — 스크롤 리빌 스태거 + 카드 호버 리프트 */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2
              data-reveal-target
              className="text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl"
            >
              필요한 실시간 기능, 전부
            </h2>
            <p data-reveal-target className="mt-2 max-w-2xl text-pretty text-text-muted">
              구독·발행·presence·히스토리·멀티테넌트 보안까지. 작은 표면적, 명확한 계약.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  data-reveal-target
                  style={{ '--i': i } as React.CSSProperties}
                  className="lift-card group rounded-lg border border-border bg-surface p-5 hover:border-accent/60"
                >
                  <div className="grid size-10 place-items-center rounded-md bg-accent-soft text-accent-fg transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                    <f.icon className="size-[1.2rem]" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-text">{f.title}</h3>
                  <p className="mt-1.5 text-[0.875rem] text-pretty text-text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 빠른 시작 — 서버/브라우저 스니펫 토글 */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,1.15fr)]">
            <div data-reveal-target>
              <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
                양쪽 다, 한 줄이면 됩니다
              </h2>
              <p className="mt-3 text-pretty text-text-muted">
                secret 키로 채널에 이벤트를 발행하면, 그 채널을 구독 중인 모든 브라우저에 즉시
                전달됩니다. 히스토리를 켜면 자동으로 최근 메시지가 저장됩니다.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  ['pk', '브라우저 — 구독·presence·히스토리 조회'],
                  ['sk', '서버 — publish·어드민(해시로만 저장)'],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-start gap-3">
                    <code className="mt-0.5 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-semibold text-accent-strong">
                      {k}_
                    </code>
                    <span className="text-sm text-text-muted">{v}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-7">
                <Link to="/login">
                  <Webhook className="size-4" />키 발급받기
                </Link>
              </Button>
            </div>

            <div data-reveal-target className="min-w-0">
              {/* 코드 예시 토글 — 서버 publish ↔ 브라우저 subscribe (버튼 그룹) */}
              <div
                role="group"
                aria-label="코드 예시 선택"
                className="mb-2.5 inline-flex gap-1 rounded-lg border border-border bg-surface-2 p-1"
              >
                {(Object.keys(SNIPPETS) as SnippetKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none',
                      tab === key ? 'bg-bg text-text shadow-xs' : 'text-text-muted hover:text-text'
                    )}
                  >
                    {SNIPPETS[key].label}
                  </button>
                ))}
              </div>
              <CodeBlock code={SNIPPETS[tab].code} language="ts" />
            </div>
          </div>
        </section>

        {/* 3단계 — 리빌 스태거 + 연결선 */}
        <section className="border-y border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2
              data-reveal-target
              className="text-2xl font-semibold tracking-tight text-text sm:text-3xl"
            >
              3단계로 라이브
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  data-reveal-target
                  style={{ '--i': i } as React.CSSProperties}
                  className="lift-card relative rounded-lg border border-border bg-surface p-6 hover:border-accent/50"
                >
                  <span className="font-mono text-sm font-semibold text-accent-strong">{s.n}</span>
                  <h3 className="mt-2 text-base font-semibold text-text">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-pretty text-text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA — 시그널 글로우 드라마 */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div
            data-reveal-target
            className="relative overflow-hidden rounded-2xl border border-border-strong/60 bg-gradient-to-b from-surface to-surface-2 px-6 py-14 text-center sm:px-10 sm:py-20"
          >
            <span
              className="signal-glow top-[-8rem] left-1/2 size-[26rem] -translate-x-1/2"
              aria-hidden
            />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-fg">
                <Gauge className="size-3.5" aria-hidden />
                1분이면 첫 메시지
              </span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-balance text-text sm:text-4xl">
                지금 가입하고 키를 받으세요
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-text-muted">
                첫 메시지를 채널에 흘려보내는 데 1분이면 충분합니다. 카드도, 서버 설정도 필요
                없습니다.
              </p>
              <Button asChild size="lg" className="group mt-8">
                <Link to="/login">
                  무료로 시작하기
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-text-subtle sm:flex-row sm:px-6">
          <Brand compact className="text-text-muted" />
          <p>RealtimeDesk — 실시간 pub/sub·presence as a service</p>
          <div className="flex items-center gap-4">
            <Link to="/sitemap" className="transition-colors hover:text-text">
              디자인
            </Link>
            <Link to="/support" className="transition-colors hover:text-text">
              문의
            </Link>
            <Link to="/login" className="transition-colors hover:text-text">
              시작하기
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
