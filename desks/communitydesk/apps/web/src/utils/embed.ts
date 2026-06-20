/**
 * 임베드 스니펫 생성기 — 랜딩·임베드 가이드가 공유한다.
 * endpoint 는 위젯이 붙을 API 베이스 URL(공개 경로 /api/boards·/api/posts 등을 호출),
 * publishableKey(pk_...) 는 브라우저 노출 안전.
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  boardSlug: string
  /** 강조색(버튼/선택). */
  accent?: string
}

/** 비-React 사이트: IIFE 스크립트 + mount 한 줄. */
export function vanillaSnippet({ publishableKey, endpoint, boardSlug, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentLine = accent ? `,\n    accent: '${accent}'` : ''
  return `<!-- CommunityDesk 게시판 위젯 -->
<div id="community"></div>
<script src="${base}/community-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    CommunityDesk.mount('#community', {
      publishableKey: '${publishableKey}',
      endpoint: '${base}',
      boardSlug: '${boardSlug}',
      memberId: currentUser?.id,   // 호스트 앱의 로그인 사용자(없으면 읽기 전용)
      memberName: currentUser?.name${accentLine}
    })
  })
</script>`
}

/** React 앱: 패키지 설치 후 컴포넌트 한 줄. */
export function reactSnippet({ publishableKey, endpoint, boardSlug, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentProp = accent ? `\n        accent="${accent}"` : ''
  return `import { CommunityBoard } from '@communitydesk/widget'

export function Community() {
  return (
    <CommunityBoard
      publishableKey="${publishableKey}"
      endpoint="${base}"
      boardSlug="${boardSlug}"
      memberId={currentUser?.id}      // 있으면 글/댓글/반응 작성 UI 활성
      memberName={currentUser?.name}${accentProp}
    />
  )
}`
}

/** 서버(secret): 검수·운영은 secret 키로(브라우저 노출 금지). */
export function adminSnippet({ endpoint }: Pick<EmbedConfig, 'endpoint'>): string {
  const base = endpoint.replace(/\/+$/, '')
  return `import { createCommunityAdminClient } from '@communitydesk/sdk'

// secret 키는 서버 환경변수로만(브라우저 노출 금지).
const admin = createCommunityAdminClient({
  secretKey: process.env.COMMUNITYDESK_SECRET_KEY,
  endpoint: '${base}',
})

await admin.moderatePost(postId, { action: 'hide' })`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @communitydesk/widget
# 또는: pnpm add @communitydesk/widget`
}
