/**
 * 임베드 스니펫 생성기 — 랜딩·가이드·Embed 탭이 공유한다.
 * endpoint 는 위젯이 붙을 API 베이스 URL(공개 pk 경로 /api/conversations·실시간 /chat 사용).
 * 브라우저에는 publishable 키(pk_…)만 노출한다. secret 키(sk_…)는 서버 전용.
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  /** 데모/예시 멤버 id(호스트 앱의 사용자 id). */
  memberId?: string
  accent?: string
}

const PK_PLACEHOLDER = 'pk_여기에_publishable_키'
const MEMBER_PLACEHOLDER = 'current-user-id'

/** 비-React 사이트: IIFE 스크립트 + init 한 줄. */
export function vanillaSnippet({ publishableKey, endpoint, memberId, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const pk = publishableKey || PK_PLACEHOLDER
  const member = memberId || MEMBER_PLACEHOLDER
  const accentLine = accent ? `,\n      accent: '${accent}'` : ''
  return `<!-- ChatDesk 채팅 위젯 -->
<script src="${base}/chat-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    ChatDesk.init({
      publishableKey: '${pk}',
      endpoint: '${base}',
      memberId: '${member}'${accentLine}
    })
  })
</script>`
}

/** React 앱: 패키지 설치 후 컴포넌트 한 줄. */
export function reactSnippet({ publishableKey, endpoint, memberId, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const pk = publishableKey || PK_PLACEHOLDER
  const member = memberId || MEMBER_PLACEHOLDER
  const accentProp = accent ? `\n        accent="${accent}"` : ''
  return `import { ChatWidget } from '@chatdesk/widget'

export function App() {
  return (
    <>
      {/* ...앱 콘텐츠... */}
      <ChatWidget
        publishableKey="${pk}"
        endpoint="${base}"
        memberId="${member}"${accentProp}
      />
    </>
  )
}`
}

/** 서버(호스트 백엔드): secret 키로 대화 생성·시스템 발송·멤버 토큰 발급. */
export function serverSnippet({ endpoint }: Pick<EmbedConfig, 'endpoint'>): string {
  const base = endpoint.replace(/\/+$/, '')
  return `import { createChatAdmin } from '@chatdesk/sdk/admin'

// secret 키(sk_…)는 서버 환경변수로만. 브라우저에 노출 금지.
const admin = createChatAdmin({
  secretKey: process.env.CHATDESK_SECRET_KEY,
  endpoint: '${base}',
})

// 1:1 DM 생성(같은 멤버쌍은 자동 dedupe)
const dm = await admin.createConversation({ kind: 'dm', memberIds: ['alice', 'bob'] })

// 시스템(공지) 발송 — 실시간 브로드캐스트 + 영속화
await admin.systemSend(dm.id, '점검이 예정되어 있습니다.')

// 브라우저 강화 인증용 멤버 토큰 발급(선택)
const { token } = await admin.issueMemberToken('alice')`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @chatdesk/widget
# 또는: pnpm add @chatdesk/widget`
}
