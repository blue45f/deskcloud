/**
 * 임베드 스니펫 생성기 — 랜딩·설정(임베드 탭)·디자인 가이드가 공유한다.
 * endpoint 는 위젯이 붙을 API 베이스 URL(공개 경로 /api/reviews/* 를 호출).
 * publishableKey(pk_...)만 위젯에 넣는다 — 브라우저 노출 안전(제출 + 승인본 읽기).
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  subjectId?: string
  subjectLabel?: string
  accent?: string
}

const DEFAULT_PK = 'pk_live_xxx'
const DEFAULT_SUBJECT = 'pro-plan'

function base(endpoint: string): string {
  return endpoint.replace(/\/+$/, '')
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @reviewdesk/widget
# 또는: pnpm add @reviewdesk/widget`
}

/** React 앱: 네 위젯을 한 페이지에 배치하는 예시. */
export function reactSnippet({
  publishableKey,
  endpoint,
  subjectId,
  subjectLabel,
  accent,
}: EmbedConfig): string {
  const pk = publishableKey || DEFAULT_PK
  const sid = subjectId || DEFAULT_SUBJECT
  const accentProp = accent ? `, accent: '${accent}'` : ''
  const labelProp = subjectLabel ? `\n        subjectLabel="${subjectLabel}"` : ''
  return `import {
  ReviewStars,
  ReviewList,
  ReviewForm,
  TestimonialWall,
} from '@reviewdesk/widget'

const cfg = { publishableKey: '${pk}', endpoint: '${base(endpoint)}'${accentProp} }

export function ProductPage() {
  return (
    <>
      <h1>제품 <ReviewStars {...cfg} subjectId="${sid}" href="#reviews" /></h1>

      {/* 후기 월(승인+추천) */}
      <TestimonialWall {...cfg} limit={9} />

      <section id="reviews">
        <ReviewList {...cfg} subjectId="${sid}" />
        <ReviewForm {...cfg} subjectId="${sid}"${labelProp} collectEmail />
      </section>
    </>
  )
}`
}

/** 단일 위젯 React 스니펫(임베드 탭의 위젯별 카드용). */
export function reactWidgetSnippet(
  widget: 'ReviewStars' | 'ReviewList' | 'ReviewForm' | 'TestimonialWall',
  { publishableKey, endpoint, subjectId, subjectLabel, accent }: EmbedConfig
): string {
  const pk = publishableKey || DEFAULT_PK
  const sid = subjectId || DEFAULT_SUBJECT
  const accentProp = accent ? `\n  accent="${accent}"` : ''
  const lines = [`  publishableKey="${pk}"`, `  endpoint="${base(endpoint)}"`]
  if (widget !== 'TestimonialWall') lines.push(`  subjectId="${sid}"`)
  if (widget === 'ReviewForm') {
    if (subjectLabel) lines.push(`  subjectLabel="${subjectLabel}"`)
    lines.push('  collectEmail')
  }
  if (widget === 'TestimonialWall' || widget === 'ReviewList') lines.push('  limit={9}')
  return `import { ${widget} } from '@reviewdesk/widget'

<${widget}
${lines.join('\n')}${accentProp}
/>`
}

/** 비-React 사이트: data-* 플레이스홀더 + IIFE 스크립트 한 줄. */
export function vanillaSnippet({
  publishableKey,
  endpoint,
  subjectId,
  subjectLabel,
  accent,
}: EmbedConfig): string {
  const b = base(endpoint)
  const pk = publishableKey || DEFAULT_PK
  const sid = subjectId || DEFAULT_SUBJECT
  const accentLine = accent ? `,\n    accent: '${accent}'` : ''
  const labelAttr = subjectLabel ? ` data-subject-label="${subjectLabel}"` : ''
  return `<!-- ReviewDesk 위젯 — 플레이스홀더 -->
<div data-reviewdesk="stars" data-subject-id="${sid}"></div>
<div data-reviewdesk="wall" data-limit="9"></div>
<div data-reviewdesk="list" data-subject-id="${sid}"></div>
<div data-reviewdesk="form" data-subject-id="${sid}"${labelAttr} data-collect-email></div>

<!-- 로더 -->
<script src="${b}/reviewdesk-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    ReviewDesk.init({
      publishableKey: '${pk}',
      endpoint: '${b}'${accentLine}
    })
  })
</script>`
}
