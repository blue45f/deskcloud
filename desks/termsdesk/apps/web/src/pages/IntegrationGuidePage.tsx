import {
  ArrowRight,
  BookOpen,
  Code2,
  ExternalLink,
  Globe,
  KeyRound,
  ListChecks,
  MousePointerClick,
  Palette,
  ShieldCheck,
  SquareCode,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/feedback'
import { Field, Select } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSession } from '@/services/auth'
import { usePolicies } from '@/services/policies'

const TERMSDESK_DEMO_ACTION_LOG_KEY = 'termsdesk-demo-action-log-v1'

type TermsDeskDemoActionLog = {
  id: string
  at: number
  action: string
  label: string
  detail?: string
}

const readDemoActionLogs = (): TermsDeskDemoActionLog[] => {
  if (typeof window === 'undefined') return []

  try {
    const raw = globalThis.localStorage.getItem(TERMSDESK_DEMO_ACTION_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is TermsDeskDemoActionLog => {
        const candidate = item as Partial<TermsDeskDemoActionLog>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.at === 'number' &&
          typeof candidate.action === 'string' &&
          typeof candidate.label === 'string'
        )
      })
      .slice(-48)
  } catch {
    return []
  }
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="relative">
      {lang && (
        <span className="absolute left-3 top-2.5 text-[0.65rem] font-semibold uppercase tracking-wide text-text-subtle">
          {lang}
        </span>
      )}
      <pre className="overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 pr-10 pt-7 font-mono text-[0.78rem] leading-relaxed text-text">
        {code}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton value={code} label="코드 복사" />
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-ink-fg">
        {n}
      </div>
      <div className="min-w-0 flex-1 pb-6">
        <h3 className="text-[0.95rem] font-semibold text-text">{title}</h3>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-text-muted">{children}</div>
      </div>
    </div>
  )
}

function SectionTitle({
  icon,
  kicker,
  title,
  desc,
}: {
  icon: ReactNode
  kicker: string
  title: string
  desc: string
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-wide text-accent-strong">
        {icon}
        {kicker}
      </div>
      <h2 className="mt-1.5 text-lg font-bold tracking-tight text-text">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">{desc}</p>
    </div>
  )
}

export default function IntegrationGuidePage() {
  useDocumentTitle('연동 가이드')
  const policies = usePolicies()
  const session = useSession()
  const published = (policies.data ?? []).filter((p) => p.currentVersionId)
  const [slug, setSlug] = useState('')
  const [demoActionLogs] = useState<TermsDeskDemoActionLog[]>(readDemoActionLogs)
  const activeSlug = slug || published[0]?.slug || 'terms-of-service'
  const activeName = published.find((p) => p.slug === activeSlug)?.name ?? '이용약관'
  const org = session.data?.org.slug ?? '_'
  const base =
    typeof window !== 'undefined' ? globalThis.location.origin : 'https://terms.your-company.com'
  const guideDemoChecks = useMemo(
    () => [
      {
        label: '라이브 데모에서 정책 선택',
        done: demoActionLogs.some((log) => log.action === 'policy-change'),
      },
      {
        label: 'subjectRef 시나리오 테스트',
        done: demoActionLogs.some(
          (log) => log.action === 'subject-preset' || log.action === 'subject-custom'
        ),
      },
      {
        label: '동의 게이트 영수증 기록',
        done: demoActionLogs.some((log) => log.action === 'consent-accepted'),
      },
      {
        label: '현재 약관 코드 스니펫 확인',
        done: Boolean(activeSlug),
      },
    ],
    [activeSlug, demoActionLogs]
  )
  const guideDemoRate = Math.round(
    (guideDemoChecks.filter((check) => check.done).length / guideDemoChecks.length) * 100
  )

  // ── 스타일링 컨트롤 (호스팅 렌더 커스터마이즈 라이브 프리뷰) ──
  const [sTheme, setSTheme] = useState<'auto' | 'light' | 'dark'>('auto')
  const [accent, setAccent] = useState('#b45309')
  const [sFont, setSFont] = useState<'sans' | 'serif'>('sans')
  const [sAlign, setSAlign] = useState<'left' | 'center'>('left')
  const [sWidth, setSWidth] = useState<'narrow' | 'normal' | 'wide'>('normal')

  const styleParams = new URLSearchParams()
  if (sTheme !== 'auto') styleParams.set('theme', sTheme)
  if (accent.toLowerCase() !== '#b45309') styleParams.set('accent', accent.replace(/^#/, ''))
  if (sFont !== 'sans') styleParams.set('font', sFont)
  if (sAlign !== 'left') styleParams.set('align', sAlign)
  if (sWidth !== 'normal') styleParams.set('width', sWidth)
  const styleQs = styleParams.toString()
  const styledHtmlPath = `/api/public/${org}/policies/${activeSlug}/html${
    styleQs ? `?${styleQs}` : ''
  }`
  const styledHtmlUrl = `${base}${styledHtmlPath}`

  const styledIframeSnippet = `<iframe
  src="${styledHtmlUrl}"
  title="${activeName}" loading="lazy"
  style="width:100%; height:620px; border:1px solid #e7e3da; border-radius:14px"
></iframe>`

  const styledEmbedAttrs = [
    `data-termsdesk-policy="${activeSlug}"`,
    sTheme !== 'auto' ? `data-termsdesk-theme="${sTheme}"` : '',
    accent.toLowerCase() !== '#b45309' ? `data-termsdesk-accent="${accent.replace(/^#/, '')}"` : '',
    sFont !== 'sans' ? `data-termsdesk-font="${sFont}"` : '',
    sAlign !== 'left' ? `data-termsdesk-align="${sAlign}"` : '',
    sWidth !== 'normal' ? `data-termsdesk-width="${sWidth}"` : '',
  ].filter(Boolean)
  const styledEmbedSnippet = `<a href="#"\n   ${styledEmbedAttrs.join('\n   ')}>${activeName}</a>`

  const verifySnippet = `# 현재본 무결성 확인 (저장 본문을 다시 해싱해 게시 해시와 대조)
curl "${base}/api/public/${org}/policies/${activeSlug}/verify"

# 특정 영수증의 contentHash 가 진본인지 확인
curl "${base}/api/public/${org}/policies/${activeSlug}/verify?hash=<contentHash>"
# → { "verified": true, "versionLabel": "...", "recomputedHash": "...", "publishedAt": "..." }`

  // 직접 렌더(JSON) 용 — 권장 마크업 구조 + CSS 변수만 바꿔 다양한 룩.
  const jsonMarkupSnippet = `<!-- fetch 한 데이터를 이 구조에 채워 넣으세요 -->
<article class="td">
  <p class="td-kicker">\${policy.orgName ?? 'ACME'}</p>
  <h1 class="td-title">\${policy.name}</h1>
  <p class="td-meta">\${policy.versionLabel} · 시행 \${policy.effectiveAt}</p>
  <div class="td-body">\${policy.body}</div>   <!-- white-space: pre-wrap -->
  <p class="td-foot">변조 방지 게시본 · \${policy.contentHash}</p>
</article>`

  const cssBaseSnippet = `.td {
  --td-accent: #b45309;            /* 강조색만 바꿔도 분위기가 달라집니다 */
  --td-text: #1c1a17; --td-muted: #6b6760; --td-border: #e9e5dd;
  max-width: 46rem; margin: 0 auto; color: var(--td-text);
  font-family: "Pretendard", system-ui, sans-serif; line-height: 1.8;
}
.td-kicker { color: var(--td-accent); font-weight: 600; font-size: .8rem;
  letter-spacing: .02em; text-transform: uppercase; }
.td-title { font-size: 1.9rem; font-weight: 700; margin: .4rem 0 .8rem; }
.td-meta  { color: var(--td-muted); font-size: .85rem;
  padding-bottom: 1rem; border-bottom: 1px solid var(--td-border); }
.td-body  { white-space: pre-wrap; margin-top: 1.5rem; word-break: keep-all; }
.td-foot  { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid var(--td-border);
  color: var(--td-muted); font-size: .75rem; word-break: break-all; }`

  const cssVariantsSnippet = `/* 문서형(Legal) — 명조체 + 좁은 폭 */
.td.legal { font-family: "Noto Serif KR", Georgia, serif; max-width: 38rem; }

/* 카드형 — 박스 + 그림자 */
.td.card { background: #fff; border: 1px solid var(--td-border);
  border-radius: 16px; padding: 2.5rem; box-shadow: 0 8px 30px -12px rgba(0,0,0,.12); }

/* 다크 — 변수만 교체 */
.td.dark { --td-text: #f1ede4; --td-muted: #b3ad9f; --td-border: #322d23;
  --td-accent: #f59e0b; background: #16140f; }`

  // ── 약관 노출(렌더링) 스니펫 ──────────────────────────────────────────────
  const hostedUrl = `${base}/p/${org}/${activeSlug}`
  const hostedSnippet = `<!-- 사이트 푸터 등 어디서나. 모바일 반응형·라이트/다크 자동. -->
<a href="${hostedUrl}" target="_blank" rel="noopener noreferrer">
  ${activeName}
</a>

<!-- 특정 버전 고정:  ${hostedUrl}?version=v2 -->
<!-- 동적 변수 치환:  ${hostedUrl}?company_name=Acme -->`

  const popupSnippet = `<!-- ① 페이지에 한 번만: 임베드 위젯 -->
<script src="${base}/api/public/embed.js" data-org="${org}" defer></script>

<!-- ② 약관을 띄울 링크·버튼 (여러 개 가능) -->
<a href="#" data-termsdesk-policy="${activeSlug}">${activeName}</a>

<!-- 다크 테마 + 동적 변수로 열기 -->
<a href="#"
   data-termsdesk-policy="${activeSlug}"
   data-termsdesk-theme="dark"
   data-termsdesk-var-company_name="Acme">${activeName}</a>`

  const iframeSnippet = `<iframe
  src="${base}/api/public/${org}/policies/${activeSlug}/html"
  title="${activeName}"
  loading="lazy"
  style="width:100%; height:620px; border:1px solid var(--border,#e7e3da); border-radius:14px"
></iframe>

<!-- 테마/버전 고정:  .../html?theme=dark&version=v2 -->`

  const fetchSnippet = `// 본문·메타를 가져와 원하는 DOM 에 직접 렌더 (완전한 스타일 제어)
const res = await fetch(
  '${base}/api/public/${org}/policies/${activeSlug}?company_name=Acme',
)
const policy = await res.json()

document.querySelector('#terms-title').textContent = policy.name
const body = document.querySelector('#terms-body')
body.style.whiteSpace = 'pre-wrap'  // 줄바꿈 보존
body.textContent = policy.body

// policy.versionLabel · policy.contentHash · policy.availableVersions
// policy.effectiveAt · policy.unresolvedVars  도 함께 제공됩니다`

  const corsCheckSnippet = `# 브라우저와 같은 Origin 을 넣어 CORS 헤더를 확인
curl -i \\
  -H "Origin: https://your-app.example" \\
  "${base}/api/public/${org}/policies/${activeSlug}"

# POST/커스텀 헤더가 있는 폼은 프리플라이트도 확인
curl -i -X OPTIONS \\
  -H "Origin: https://your-app.example" \\
  -H "Access-Control-Request-Method: GET" \\
  "${base}/api/public/${org}/policies/${activeSlug}"`

  const sameOriginProxySnippet = `// 외부 fetch 를 막는 환경이면 고객 사이트에 같은 출처 프록시를 둡니다.
app.get('/api/legal/policies/:slug', async (req, res) => {
  const upstream = await fetch(
    '${base}/api/public/${org}/policies/' + encodeURIComponent(req.params.slug),
    { headers: { accept: 'application/json' } },
  )
  if (!upstream.ok) {
    return res.status(502).json({ error: 'policy_fetch_failed:' + upstream.status })
  }
  res.set('Cache-Control', 'no-store')
  res.json(await upstream.json())
})

// 브라우저는 같은 출처만 호출합니다.
const policy = await fetch('/api/legal/policies/${activeSlug}').then((r) => r.json())`

  const reactRenderSnippet = `import { useEffect, useState } from 'react'
import type { PublicRenderDto } from '@termsdesk/shared'

export function Terms({ companyName }: { companyName: string }) {
  const [p, setP] = useState<PublicRenderDto | null>(null)
  useEffect(() => {
    fetch(\`${base}/api/public/${org}/policies/${activeSlug}?company_name=\${companyName}\`)
      .then((r) => r.json())
      .then(setP)
  }, [companyName])

  if (!p) return null
  return (
    <article style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
      <h1>{p.name} <small>{p.versionLabel}</small></h1>
      {p.body}
    </article>
  )
}`

  // ── 동의 수집(증거) 스니펫 ────────────────────────────────────────────────
  const restSnippet = `# 1) 현재 게시된 약관 가져오기 (게시본 본문 + content_hash)
curl "${base}/api/v1/policies/${activeSlug}/current?subjectRef=USER_ID" \\
  -H "authorization: Bearer tdk_..."

# 2) 동의 기록 (append-only 영수증)
curl -X POST "${base}/api/v1/consents" \\
  -H "authorization: Bearer tdk_..." \\
  -H "content-type: application/json" \\
  -d '{"subjectRef":"USER_ID","policySlug":"${activeSlug}","decision":"accepted"}'`

  const reactSnippet = `import { createTermsDeskClient } from '@termsdesk/sdk'
import { ConsentGate } from '@termsdesk/sdk/react'

const client = createTermsDeskClient({
  baseUrl: '${base}',
  apiKey: 'tdk_...', // publishable 키
})

export function App({ userId }: { userId: string }) {
  return (
    <ConsentGate client={client} policySlug="${activeSlug}" subjectRef={userId}>
      {/* 동의가 끝나야 이 안이 렌더됩니다 */}
      <YourApp />
    </ConsentGate>
  )
}`

  const vanillaSnippet = `import { createTermsDeskClient } from '@termsdesk/sdk'

const client = createTermsDeskClient({ baseUrl: '${base}', apiKey: 'tdk_...' })

// 현재 약관 + 이 사용자의 재동의 필요 여부
const policy = await client.getCurrentPolicy({
  policySlug: '${activeSlug}',
  subjectRef: userId,
})

if (policy.reconsentRequired) {
  showModal(policy.body) // 게시본 본문을 그대로 노출
  await client.recordConsent({
    subjectRef: userId,
    policySlug: '${activeSlug}',
    contentHash: policy.contentHash, // 본 버전에 귀속
  })
}`

  return (
    <>
      <PageHeader
        title="연동 가이드"
        description="게시한 약관을 실제 사이트·앱에 다양한 방식으로 노출하고, 동의를 증거로 남기는 방법입니다."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Field
            label="연동할 약관"
            htmlFor="g-policy"
            hint="아래 모든 코드·미리보기에 자동 반영됩니다"
          >
            <Select
              id="g-policy"
              value={activeSlug}
              onChange={(e) => setSlug(e.target.value)}
              className="sm:w-72"
            >
              {published.length === 0 ? <option value={activeSlug}>{activeSlug}</option> : null}
              {published.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name} ({p.slug})
                </option>
              ))}
            </Select>
          </Field>
          <div className="text-xs text-text-subtle">
            조직 <span className="font-mono text-text-muted">{org}</span> · API 베이스{' '}
            <span className="font-mono text-text-muted">{base}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-wide text-accent-strong">
                <ListChecks className="size-3.5" />
                Demo handoff
              </div>
              <h2 className="mt-1 text-base font-bold text-text">라이브 데모 기반 도입 리허설</h2>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                데모 페이지에서 만든 정책·대상·동의 로그를 읽어, 실제 연동 전 누락된 단계가 있는지
                보여줍니다.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-right">
              <p className="text-[0.68rem] text-text-subtle">완료율</p>
              <p className="font-mono text-lg font-semibold text-text">{guideDemoRate}%</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {guideDemoChecks.map((check) => (
              <div
                key={check.label}
                className="rounded-lg border border-border bg-surface-2/35 px-3 py-2 text-xs"
              >
                <span
                  className={
                    check.done ? 'font-semibold text-success' : 'font-semibold text-text-subtle'
                  }
                >
                  {check.done ? '완료' : '대기'}
                </span>
                <p className="mt-1 text-text-muted">{check.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/demo">데모에서 로그 만들기</Link>
            </Button>
            <Button size="sm" asChild>
              <a href={hostedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                현재 약관 보기
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─────────── 약관 노출(렌더링) 방식 ─────────── */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6">
        <SectionTitle
          icon={<Globe className="size-3.5" />}
          kicker="Display"
          title="웹사이트에 약관 노출하기"
          desc="용도에 맞는 방식을 고르세요. 모두 인증 없이 동작하며, 모바일 반응형·라이트/다크·인쇄를 지원합니다. URL 파라미터로 버전 고정과 변수 치환도 됩니다."
        />

        <Tabs defaultValue="hosted">
          <TabsList className="flex-wrap">
            <TabsTrigger value="hosted">호스티드 링크</TabsTrigger>
            <TabsTrigger value="popup">팝업·모달</TabsTrigger>
            <TabsTrigger value="iframe">iframe 임베드</TabsTrigger>
            <TabsTrigger value="fetch">인라인 fetch</TabsTrigger>
            <TabsTrigger value="react">React</TabsTrigger>
          </TabsList>

          <TabsContent value="hosted" className="space-y-3 pt-3 outline-none">
            <p className="text-sm leading-relaxed text-text-muted">
              가장 간단합니다. TermsDesk 가 호스팅하는 약관 페이지로 링크만 걸면 됩니다. 별도
              스타일·빌드 불필요, 항상 최신 게시본을 노출합니다.
            </p>
            <CodeBlock code={hostedSnippet} lang="html" />
            <Button variant="secondary" size="sm" asChild>
              <a href={hostedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />이 약관 페이지 새 탭에서 열기
              </a>
            </Button>
          </TabsContent>

          <TabsContent value="popup" className="space-y-3 pt-3 outline-none">
            <p className="text-sm leading-relaxed text-text-muted">
              드롭인 위젯입니다. 스크립트 한 줄 + 링크에{' '}
              <code className="font-mono text-xs">data-termsdesk-policy</code> 속성만 추가하면, 클릭
              시 모달(데스크톱)·바텀시트(모바일)로 약관이 열립니다. 페이지 이동이 없습니다.
            </p>
            <CodeBlock code={popupSnippet} lang="html" />
            <p className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-xs text-text-subtle">
              <span className="font-medium text-text-muted">변수 전달</span> ·{' '}
              <code className="font-mono">data-termsdesk-var-키="값"</code> →{' '}
              <code className="font-mono">{`{{키}}`}</code> 치환. 테마는{' '}
              <code className="font-mono">data-termsdesk-theme</code>, 버전은{' '}
              <code className="font-mono">data-termsdesk-version</code>.
            </p>
          </TabsContent>

          <TabsContent value="iframe" className="space-y-3 pt-3 outline-none">
            <p className="text-sm leading-relaxed text-text-muted">
              완성된 약관 문서를 페이지에 직접 끼워 넣습니다. 자체 호스팅 사이트의 약관 전용
              페이지에 적합합니다.
            </p>
            <CodeBlock code={iframeSnippet} lang="html" />
          </TabsContent>

          <TabsContent value="fetch" className="space-y-3 pt-3 outline-none">
            <p className="text-sm leading-relaxed text-text-muted">
              본문·메타를 JSON 으로 받아 직접 렌더합니다. 디자인을 100% 제어하고 싶을 때. 본문은
              줄바꿈을 보존(<code className="font-mono text-xs">white-space: pre-wrap</code>)하세요.
            </p>
            <CodeBlock code={fetchSnippet} lang="javascript" />
          </TabsContent>

          <TabsContent value="react" className="space-y-3 pt-3 outline-none">
            <p className="text-sm leading-relaxed text-text-muted">
              React 에서 본문만 렌더하는 최소 예시입니다. 동의 수집까지 필요하면 아래{' '}
              <span className="text-text">동의 받기</span> 섹션의{' '}
              <code className="font-mono text-xs">{'<ConsentGate>'}</code> 를 쓰세요.
            </p>
            <CodeBlock code={reactRenderSnippet} lang="tsx" />
          </TabsContent>
        </Tabs>

        <div className="mt-6 rounded-lg border border-border bg-surface-2/35 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
            CORS 점검 · 운영 프록시
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
            공개 API 는 브라우저 직접 호출을 지원합니다. 배포 프록시·WAF·커스텀 도메인 설정 뒤에는
            Origin 헤더를 넣어 실제 브라우저 조건으로 확인하세요. 사내망이나 보안 정책상 외부 fetch
            가 막히면 같은 출처 프록시를 두면 됩니다.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <CodeBlock code={corsCheckSnippet} lang="bash" />
            <CodeBlock code={sameOriginProxySnippet} lang="js" />
          </div>
        </div>

        {/* 라이브 미리보기 + 동적 파라미터 */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-muted">
              <MousePointerClick className="size-3.5 text-text-subtle" />
              라이브 미리보기 (HTML 렌더)
            </div>
            <iframe
              key={`${org}/${activeSlug}`}
              title="약관 미리보기"
              src={`/api/public/${org}/policies/${activeSlug}/html`}
              loading="lazy"
              className="h-[22rem] w-full rounded-lg border border-border bg-surface-2/30"
            />
          </div>
          <div className="rounded-lg border border-border bg-surface-2/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
              동적 약관 · URL 파라미터
            </div>
            <ul className="mt-3 space-y-3 text-sm text-text-muted">
              <li>
                <div className="font-medium text-text">버전 고정</div>
                <code className="mt-0.5 block break-all font-mono text-[0.72rem] text-text-subtle">
                  ?version=v2
                </code>
                특정 게시 버전을 그대로 노출(미지정 시 현재본).
              </li>
              <li>
                <div className="font-medium text-text">변수 치환</div>
                <code className="mt-0.5 block break-all font-mono text-[0.72rem] text-text-subtle">
                  ?company_name=Acme&plan=Pro
                </code>
                본문의 <code className="font-mono text-[0.72rem]">{`{{company_name}}`}</code> 등을
                값으로 치환. 값이 없으면 자리표시자를 그대로 남깁니다(증거 해시는 원문 불변).
              </li>
              <li>
                <div className="font-medium text-text">테마</div>
                <code className="mt-0.5 block break-all font-mono text-[0.72rem] text-text-subtle">
                  ?theme=dark
                </code>
                라이트/다크 강제(미지정 시 사용자 시스템 설정).
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-success/30 bg-success-soft/40 p-4">
          <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-wide text-success">
            <ShieldCheck className="size-3.5" />
            변조 검증 (감사자용 · 무인증)
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
            누구나 영수증의 <code className="font-mono text-xs">content_hash</code>가 진짜 게시본의
            해시인지 확인할 수 있습니다. 서버가 저장된 본문을{' '}
            <span className="text-text">지금 다시 해싱</span>해 게시 시점 해시와 대조합니다.
          </p>
          <div className="mt-3">
            <CodeBlock code={verifySnippet} lang="bash" />
          </div>
        </div>
      </div>

      {/* ─────────── 스타일링 ─────────── */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6">
        <SectionTitle
          icon={<Palette className="size-3.5" />}
          kicker="Styling"
          title="스타일링 — 보이는 방식 바꾸기"
          desc="그대로 쓰되 강조색·폰트·정렬·폭만 손보거나(호스팅 렌더), JSON으로 받아 내 CSS로 완전히 새로 그릴 수 있습니다. 어느 쪽이든 게시 원문·해시는 그대로입니다."
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <h3 className="text-sm font-semibold text-text">① 호스팅 렌더 커스터마이즈</h3>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              값을 바꾸면 미리보기와 코드가 즉시 갱신됩니다. 그대로 URL 파라미터로 동작합니다.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-text-muted">
                테마
                <Select
                  className="mt-1"
                  value={sTheme}
                  onChange={(e) => setSTheme(e.target.value as typeof sTheme)}
                >
                  <option value="auto">auto</option>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </Select>
              </label>
              <label className="text-xs font-medium text-text-muted">
                강조색
                <span className="mt-1 flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label="강조색 선택"
                  />
                  <span className="font-mono text-[0.7rem] text-text-muted">{accent}</span>
                </span>
              </label>
              <label className="text-xs font-medium text-text-muted">
                폰트
                <Select
                  className="mt-1"
                  value={sFont}
                  onChange={(e) => setSFont(e.target.value as typeof sFont)}
                >
                  <option value="sans">sans</option>
                  <option value="serif">serif</option>
                </Select>
              </label>
              <label className="text-xs font-medium text-text-muted">
                정렬
                <Select
                  className="mt-1"
                  value={sAlign}
                  onChange={(e) => setSAlign(e.target.value as typeof sAlign)}
                >
                  <option value="left">left</option>
                  <option value="center">center</option>
                </Select>
              </label>
              <label className="text-xs font-medium text-text-muted">
                폭
                <Select
                  className="mt-1"
                  value={sWidth}
                  onChange={(e) => setSWidth(e.target.value as typeof sWidth)}
                >
                  <option value="narrow">narrow</option>
                  <option value="normal">normal</option>
                  <option value="wide">wide</option>
                </Select>
              </label>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <iframe
                key={styledHtmlPath}
                src={styledHtmlPath}
                title="스타일 미리보기"
                loading="lazy"
                className="h-[20rem] w-full bg-surface-2/30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-text-muted">iframe 임베드</div>
            <CodeBlock code={styledIframeSnippet} lang="html" />
            <div className="pt-1 text-xs font-medium text-text-muted">팝업 위젯 트리거</div>
            <CodeBlock code={styledEmbedSnippet} lang="html" />
            <p className="pt-1 text-[0.72rem] leading-relaxed text-text-subtle">
              파라미터 · <code className="font-mono">theme</code> auto·light·dark ·{' '}
              <code className="font-mono">accent</code> hex ·{' '}
              <code className="font-mono">font</code> sans·serif ·{' '}
              <code className="font-mono">align</code> left·center ·{' '}
              <code className="font-mono">width</code> narrow·normal·wide
            </p>
          </div>
        </div>

        <div className="mt-7 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-text">
            ② 직접 렌더(JSON) — 내 CSS로 완전 제어
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            완전한 디자인 자유도가 필요하면 JSON으로 받아 직접 그리세요. 권장 마크업 + 스타터
            CSS입니다.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <CodeBlock code={jsonMarkupSnippet} lang="html" />
            <CodeBlock code={cssBaseSnippet} lang="css" />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            CSS 변수(<code className="font-mono text-[0.72rem]">--td-accent</code> 등)만 바꿔
            변형하거나, 클래스를 더해 룩을 전환하세요(예{' '}
            <code className="font-mono text-[0.72rem]">{'<article class="td legal">'}</code>).
          </p>
          <div className="mt-2">
            <CodeBlock code={cssVariantsSnippet} lang="css" />
          </div>
        </div>
      </div>

      {/* ─────────── 동의 수집(증거) ─────────── */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <SectionTitle
          icon={<SquareCode className="size-3.5" />}
          kicker="Consent"
          title="동의를 받아 증거로 남기기"
          desc="약관 노출에 더해, 사용자의 동의를 변조 방지 영수증으로 기록하려면 아래 흐름을 사용하세요."
        />

        <Step n={1} title="API 키 발급">
          <p>
            SDK·서버가 현재 약관을 조회(<code className="font-mono text-xs">read:current</code>)하고
            동의를 기록(<code className="font-mono text-xs">write:consent</code>)하려면 publishable
            API 키가 필요합니다. (앞의 노출 방식은 키 없이 동작합니다.)
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/app/api-keys">
              <KeyRound className="size-4" />
              API 키 발급하러 가기
            </Link>
          </Button>
        </Step>

        <Step n={2} title="현재 약관을 띄우고, 동의를 받기">
          <p>
            방법을 골라 복사하세요. <span className="text-text">React</span>가 가장 간단합니다(동의
            게이트가 알아서 본문 표시 → 동의 → 영수증 기록까지 처리).
          </p>
          <Tabs defaultValue="react">
            <TabsList>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="vanilla">바닐라 JS</TabsTrigger>
              <TabsTrigger value="rest">REST (cURL)</TabsTrigger>
            </TabsList>
            <TabsContent value="react" className="pt-3 outline-none">
              <CodeBlock code={reactSnippet} lang="tsx" />
            </TabsContent>
            <TabsContent value="vanilla" className="pt-3 outline-none">
              <CodeBlock code={vanillaSnippet} lang="javascript" />
            </TabsContent>
            <TabsContent value="rest" className="pt-3 outline-none">
              <CodeBlock code={restSnippet} lang="bash" />
            </TabsContent>
          </Tabs>
          <p className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-xs text-text-subtle">
            <span className="font-medium text-text-muted">subjectRef</span>는 회사가 부여하는 끝단
            사용자 식별자입니다(예: 회원 ID). TermsDesk는 원본 PII를 저장하지 않습니다.
          </p>
        </Step>

        <Step n={3} title="기록된 동의 확인">
          <p>
            연동 후 동의가 들어오면 <span className="text-text">동의 영수증</span>에 누가·어떤
            버전(해시)에·언제 동의했는지 즉시 쌓입니다. CSV로 내보내 규제·감사에 그대로 제출할 수
            있습니다.
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/app/consents">
              <ListChecks className="size-4" />
              동의 영수증 보기
            </Link>
          </Button>
        </Step>

        <Step n={4} title="약관을 바꾸면 자동으로 재동의">
          <p>
            새 버전을 <span className="text-text">재동의 필요</span>로 게시하면, 구버전에만 동의한
            사용자는 SDK가 다음 방문 때 자동으로 동의 게이트를 다시 엽니다. 게시본은 동결되어 바뀌지
            않으므로, 각 사용자가 정확히 어떤 문안에 동의했는지가 영구히 증명됩니다.
          </p>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/demo">
              라이브 데모에서 직접 확인 <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </Step>

        <div className="ml-11 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-xs text-text">
          <span className="font-semibold">참고</span> ·{' '}
          <code className="font-mono">@termsdesk/sdk</code>는 현재 이 저장소의 패키지입니다. 외부
          앱에선 ① REST를 그대로 쓰거나 ② SDK를 사내 레지스트리/번들로 사용하세요(공개 npm 배포는
          추후). REST만으로도 모든 기능이 동작합니다.
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-text-muted">
        <BookOpen className="size-4 text-text-subtle" />더 자세한 내용은 저장소의{' '}
        <span className="font-mono text-xs">docs/INTEGRATION.md</span> 참고.
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm text-text-subtle">
        <Code2 className="size-4" />
        모든 공개 엔드포인트는 <span className="font-mono text-xs">/api/docs</span> (Swagger)에서도
        확인할 수 있습니다.
      </div>
    </>
  )
}
