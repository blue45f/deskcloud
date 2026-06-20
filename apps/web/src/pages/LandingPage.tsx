import {
  ArrowRight,
  Boxes,
  Check,
  Code2,
  Copy,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  Moon,
  Server,
  Shield,
  Sparkles,
  Sun,
  Wand2,
  Zap,
} from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { MemberAuthControl } from '@/components/layout/MemberAuthControl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useReveal } from '@/hooks/useReveal'
import { apiEndpoint } from '@/services/api'
import { buildTransformUrl, vanillaSnippet, type TransformParams } from '@/utils/embed'

const FEATURES = [
  {
    icon: ImageIcon,
    title: '드래그앤드롭 업로더',
    body: '미리보기·진행률·용량/MIME 가드를 갖춘 임베드 업로더. 의존성은 React(peer)뿐.',
  },
  {
    icon: Wand2,
    title: '온더플라이 변환',
    body: 'URL 쿼리(?w=&h=&format=&q=)로 리사이즈·포맷·품질. 파생 캐시로 두 번째부터 즉시.',
  },
  {
    icon: KeyRound,
    title: 'pk / sk 키 모델',
    body: 'publishable 은 브라우저, secret 은 서버. secret 은 해시로만 저장, 1회 노출.',
  },
  {
    icon: Shield,
    title: '테넌트별 CORS · 사용량',
    body: 'origin 허용목록으로 업로드를 통제하고, 바이트/건수 사용량과 free 소프트 캡을 관리.',
  },
  {
    icon: Boxes,
    title: '교체 가능한 스토리지',
    body: '로컬 파일시스템 기본 + S3 어댑터(스텁). StorageAdapter 인터페이스로 갈아끼웁니다.',
  },
  {
    icon: Gauge,
    title: 'DB 없이 즉시 실행',
    body: 'PGlite 폴백으로 Postgres·Docker 없이 부팅. 데모 테넌트·샘플 자산이 함께 시드됩니다.',
  },
] as const

const STATS = [
  { value: '1줄', label: '임베드 스니펫' },
  { value: 'pk · sk', label: '키 모델' },
  { value: 'webp · avif', label: '온더플라이 포맷' },
  { value: '0', label: '필수 네이티브 의존성' },
] as const

function Header() {
  const { resolved, toggle } = useTheme()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/sitemap">사이트맵</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/support">문의</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">콘솔</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/signup">가입</Link>
          </Button>
          {/* 회원 로그인(Firebase) — 테넌트 콘솔 로그인과 별개의 통합 로그인 진입점. */}
          <MemberAuthControl />
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
        </div>
      </div>
    </header>
  )
}

/** 히어로 뒤 장식 — 오로라 광원 + 미세 격자. 순수 장식이므로 aria-hidden. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="md-grid-texture absolute inset-0 opacity-[0.5]" />
      <div className="md-aurora absolute -top-32 left-1/2 size-[44rem] -translate-x-[60%] rounded-full bg-[radial-gradient(circle,var(--color-accent)_0%,transparent_62%)] opacity-20 blur-3xl" />
      <div className="md-aurora-slow absolute -top-24 left-1/2 size-[40rem] -translate-x-[20%] rounded-full bg-[radial-gradient(circle,var(--color-info)_0%,transparent_62%)] opacity-[0.16] blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
    </div>
  )
}

/** 변환 URL 플레이그라운드 — w/h/포맷/품질을 만지면 URL·미리보기가 실시간으로 바뀐다. */
const FORMATS = ['webp', 'avif', 'jpeg', 'png'] as const
const SIZE_PRESETS = [120, 240, 480, 800] as const

function TransformPlayground() {
  const [size, setSize] = useState<number>(240)
  const [format, setFormat] = useState<(typeof FORMATS)[number]>('webp')
  const [quality, setQuality] = useState(70)
  const [copied, setCopied] = useState(false)

  const params: TransformParams = useMemo(
    () => ({ w: size, h: size, format, q: quality }),
    [size, format, quality]
  )
  const url = buildTransformUrl('/uploads/cover.jpg', params)
  // 데모 미리보기 — 외부 네트워크 의존성 없이 순수 CSS 로 변환 결과를 시각화한다.
  // 품질↓일수록 블러를, 크기는 박스 치수에 매핑해 "변환됨"을 직관적으로 보여준다.
  const previewBlur = quality >= 85 ? 0 : (90 - quality) / 22
  const previewBox = 88 + Math.round((size / 800) * 56) // 88–132px

  const copy = () => {
    void navigator.clipboard?.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5">
        <span className="relative inline-flex size-2 text-success">
          <span className="md-pulse-ring absolute inset-0 rounded-full" />
          <span className="size-2 rounded-full bg-success" />
        </span>
        <span className="text-[0.8125rem] font-medium text-text-muted">
          라이브 변환 플레이그라운드
        </span>
        <Badge tone="accent" size="sm" className="ml-auto">
          파생 캐시 적중
        </Badge>
      </div>

      <div className="grid gap-0 sm:grid-cols-[1fr_auto]">
        {/* 컨트롤 */}
        <div className="space-y-4 p-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-text">크기</span>
              <span className="font-mono text-xs text-text-muted">
                {size}×{size}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  className={
                    size === s
                      ? 'rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-ink-fg shadow-xs transition-colors'
                      : 'rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text'
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-text">포맷</div>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  aria-pressed={format === f}
                  className={
                    format === f
                      ? 'rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-fg shadow-xs transition-colors'
                      : 'rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text'
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="md-q" className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-text">품질</span>
              <span className="font-mono text-xs text-text-muted">{quality}</span>
            </label>
            <input
              id="md-q"
              type="range"
              min={30}
              max={100}
              step={5}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-accent"
            />
          </div>
        </div>

        {/* 미리보기 — 순수 CSS(네트워크 무의존). 칸은 132px 고정으로 잡아 CLS 없음. */}
        <div className="grid w-full place-items-center border-t border-border bg-[radial-gradient(circle_at_center,var(--color-surface-2),var(--color-surface))] p-5 sm:w-auto sm:min-w-[180px] sm:border-t-0 sm:border-l">
          <div className="grid size-[132px] place-items-center">
            <div
              role="img"
              aria-label={`${size}×${size} ${format} · 품질 ${quality} 변환 미리보기`}
              className="rounded-xl border border-border-strong bg-[linear-gradient(135deg,var(--color-accent)_0%,var(--color-info)_55%,var(--color-accent-strong)_100%)] shadow-sm transition-[width,height,filter] duration-300"
              style={{
                width: previewBox,
                height: previewBox,
                filter: previewBlur ? `blur(${previewBlur}px)` : undefined,
              }}
            >
              <span className="grid size-full place-items-center font-mono text-[0.625rem] font-semibold text-white/90">
                {format}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 결과 URL */}
      <div className="flex items-center gap-2 border-t border-border bg-surface-2/40 px-4 py-2.5">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-text" title={url}>
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-muted shadow-xs transition-colors hover:border-border-strong hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
          aria-label="변환 URL 복사"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-success" /> 복사됨
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> 복사
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function LandingPage() {
  useDocumentTitle()
  useReveal()

  const endpoint = apiEndpoint() || 'https://media.example.com'
  const snippet = vanillaSnippet({
    publishableKey: 'pk_여기에_publishable_키',
    endpoint,
    folder: 'uploads',
  })

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* 히어로 */}
        <section className="relative isolate overflow-hidden">
          <HeroBackdrop />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <span className="md-enter md-enter-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-text-muted shadow-xs backdrop-blur">
                <Sparkles className="size-3.5 text-accent-strong" aria-hidden />
                업로드 · 변환 · CDN as a Service
              </span>
              <h1 className="md-enter md-enter-2 mt-5 text-[clamp(2.3rem,6.2vw,3.85rem)] leading-[1.04] font-semibold tracking-tight text-balance text-text">
                미디어 인프라를,
                <br />
                <span className="md-gradient-text">한 줄 임베드</span>로
              </h1>
              <p className="md-enter md-enter-3 mt-5 max-w-xl text-lg text-pretty text-text-muted">
                MediaDesk 는 멀티테넌트 미디어 업로드·변환·CDN SaaS 입니다. 가입하면
                publishable/secret 키를 발급받고, 브라우저에서 업로드·공개 조회를, 서버에서 자산
                관리를 합니다.
              </p>
              <div className="md-enter md-enter-4 mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="group/cta">
                  <Link to="/signup">
                    가입하고 키 발급
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/login">대시보드 들어가기</Link>
                </Button>
              </div>
              <p className="md-enter md-enter-5 mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-subtle">
                <Zap className="size-3.5 text-warning" aria-hidden />
                데모 테넌트 secret 키
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-text">
                  sk_demo_secret_key_00000000000000
                </code>
                로 바로 로그인해 둘러볼 수 있어요.
              </p>
            </div>

            {/* 인터랙티브 변환 데모 */}
            <div className="md-enter md-enter-3 lg:pl-2">
              <TransformPlayground />
            </div>
          </div>

          {/* 지표 스트립 */}
          <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="bg-surface px-4 py-4 text-center sm:py-5">
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
                    {s.value}
                  </dd>
                  <p className="mt-0.5 text-[0.6875rem] text-text-subtle sm:text-xs">{s.label}</p>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 기능 그리드 */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="주요 기능">
          <div data-reveal className="mb-8 max-w-2xl">
            <Badge tone="neutral" size="sm">
              왜 MediaDesk 인가
            </Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl">
              업로드부터 서빙까지, 결정은 이미 내려져 있습니다
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                style={{ '--reveal-delay': `${i * 70}ms` } as CSSProperties}
                className="md-lift group/card relative overflow-hidden rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-px right-0 left-0 h-px bg-gradient-to-r from-transparent via-accent/0 to-transparent opacity-0 transition-opacity duration-300 group-hover/card:via-accent/50 group-hover/card:opacity-100"
                />
                <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-fg shadow-xs transition-transform duration-200 group-hover/card:scale-105">
                  <f.icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-text">{f.title}</h3>
                <p className="mt-1.5 text-[0.8125rem] text-pretty text-text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 임베드 스니펫 */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-label="임베드 방법">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div data-reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl">
                한 줄이면 업로더 + 갤러리
              </h2>
              <p className="mt-3 max-w-prose text-pretty text-text-muted">
                비-React 사이트는 스크립트 태그 하나로 끝납니다. React 앱이라면{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  &lt;MediaUploader /&gt;
                </code>{' '}
                ·{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-text">
                  &lt;MediaGallery /&gt;
                </code>{' '}
                컴포넌트를 추가하세요.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-text-muted">
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <Code2 className="size-3.5" aria-hidden />
                  </span>
                  접근성 드롭존 · 진행률 · reduced-motion 존중
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <Wand2 className="size-3.5" aria-hidden />
                  </span>
                  변환 썸네일(webp/avif) · 파생 캐시
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-fg">
                    <Server className="size-3.5" aria-hidden />
                  </span>
                  로컬 FS 기본 · S3 어댑터로 교체 가능
                </li>
              </ul>
              <div className="mt-6">
                <Button asChild variant="secondary" className="group/cta">
                  <Link to="/signup">
                    가입하고 임베드하기
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </div>
            <div data-reveal style={{ '--reveal-delay': '90ms' } as CSSProperties}>
              <CodeBlock code={snippet} language="html" />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div
            data-reveal
            className="relative isolate overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center shadow-md sm:p-14"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <div className="md-grid-texture absolute inset-0 opacity-40" />
              <div className="md-aurora absolute -top-20 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--color-accent)_0%,transparent_62%)] opacity-[0.14] blur-3xl" />
            </div>
            <span className="md-float inline-grid size-12 place-items-center rounded-2xl bg-ink text-ink-fg shadow-lg">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl">
              네이티브 의존성 없이 배포
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-text-muted">
              sharp 가 있으면 이미지 변환을, 없으면 원본을 그대로 서빙합니다. PGlite 폴백으로 DB
              없이도 즉시 부팅되어, 어디서든 가볍게 셀프호스팅할 수 있습니다.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="group/cta">
                <Link to="/signup">
                  지금 시작
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/sitemap">사이트맵</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-text-subtle">
            <Brand compact />
            <span>MediaDesk</span>
          </div>
          <nav aria-label="푸터" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link to="/signup" className="text-text-muted transition-colors hover:text-text">
              가입
            </Link>
            <Link to="/sitemap" className="text-text-muted transition-colors hover:text-text">
              디자인 시스템
            </Link>
            <Link to="/support" className="text-text-muted transition-colors hover:text-text">
              문의
            </Link>
            <Link to="/login" className="text-text-muted transition-colors hover:text-text">
              로그인
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
