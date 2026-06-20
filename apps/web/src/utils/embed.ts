/**
 * 임베드 스니펫 생성기 — 랜딩·임베드 탭이 공유한다.
 * endpoint 는 위젯/SDK 가 호출할 ModerationDesk API 베이스 URL.
 *
 * 키 모델:
 *   - publishable(pk_…): 브라우저 안전 — 신고 버튼·작성 중 사전검사.
 *   - secret(sk_…): 서버 전용 — 콘텐츠 게이트(차단 결정)·규칙/신고/로그 관리.
 */
export interface EmbedConfig {
  /** 브라우저 위젯용 publishable 키(pk_...). */
  publishableKey: string
  endpoint: string
  accent?: string
}

const cleanBase = (endpoint: string): string => endpoint.replace(/\/+$/, '')

/** 비-React 사이트: IIFE 스크립트 + init 한 줄(신고 버튼). */
export function vanillaSnippet({ publishableKey, endpoint, accent }: EmbedConfig): string {
  const base = cleanBase(endpoint)
  const accentLine = accent ? `,\n      accent: '${accent}'` : ''
  return `<!-- ModerationDesk 신고 버튼 -->
<span id="report-slot"></span>
<script src="${base}/report-button.js"></script>
<script>
  ModerationDesk.init({
    target: '#report-slot',
    subjectType: 'comment',
    subjectId: 'c_123',
    publishableKey: '${publishableKey}',
    endpoint: '${base}'${accentLine}
  })
</script>`
}

/** React 앱: 신고 버튼 컴포넌트. */
export function reactReportSnippet({ publishableKey, endpoint, accent }: EmbedConfig): string {
  const base = cleanBase(endpoint)
  const accentProp = accent ? `\n      accent="${accent}"` : ''
  return `import { ReportButton } from '@moderationdesk/widget'

export function CommentActions({ comment, currentUser }) {
  return (
    <ReportButton
      subjectType="comment"
      subjectId={comment.id}
      publishableKey="${publishableKey}"
      endpoint="${base}"
      reporterId={currentUser?.id}${accentProp}
      onSubmitted={(r) => console.info('신고 접수됨', r)}
    />
  )
}`
}

/** React 앱: 작성 중 사전검사 배지(allow 면 조용히 숨김). */
export function reactBadgeSnippet({ publishableKey, endpoint }: EmbedConfig): string {
  const base = cleanBase(endpoint)
  return `import { ModerationBadge, useModerationCheck } from '@moderationdesk/widget'

function CommentComposer() {
  const [draft, setDraft] = useState('')
  const { verdict, loading } = useModerationCheck(draft, {
    publishableKey: '${publishableKey}',
    endpoint: '${base}',
  })
  const canSubmit = !loading && verdict !== 'block'

  return (
    <>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
      <ModerationBadge text={draft} publishableKey="${publishableKey}" endpoint="${base}" />
      <button disabled={!canSubmit}>게시</button>
    </>
  )
}`
}

/** 서버(SDK): secret 키로 콘텐츠 게이트. secret 키는 절대 브라우저로 내려보내지 말 것. */
export function serverSnippet({ endpoint }: Pick<EmbedConfig, 'endpoint'>): string {
  const base = cleanBase(endpoint)
  return `import { createModerationClient } from '@moderationdesk/sdk'

const md = createModerationClient({
  secretKey: process.env.MODERATIONDESK_SECRET_KEY, // sk_… (서버 전용)
  endpoint: '${base}',
})

const { verdict } = await md.moderate(comment, { meta: { userId } })
if (verdict === 'block') throw new Error('차단된 콘텐츠입니다')`
}

/** npm 설치 명령. */
export function installWidgetSnippet(): string {
  return `npm i @moderationdesk/widget react react-dom
# 또는: pnpm add @moderationdesk/widget`
}

export function installSdkSnippet(): string {
  return `npm i @moderationdesk/sdk
# 또는: pnpm add @moderationdesk/sdk`
}
