/**
 * 임베드/SDK 스니펫 생성기 — 랜딩·임베드 탭이 공유한다.
 *
 * - 브라우저(인박스 벨)는 publishable(`pk_`) 키로 동작 — @notifydesk/widget.
 * - 서버(발송)는 secret(`sk_`) 키로 동작 — @notifydesk/sdk. secret 키는 브라우저 노출 금지.
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  recipientId?: string
  accent?: string
}

const cleanBase = (endpoint: string): string => endpoint.replace(/\/+$/, '')

/** React 앱: 알림 벨 컴포넌트 한 줄(publishable 키). */
export function reactSnippet({
  publishableKey,
  endpoint,
  recipientId = 'user_42',
  accent,
}: EmbedConfig): string {
  const base = cleanBase(endpoint)
  const accentProp = accent ? `\n        accent="${accent}"` : ''
  return `import { NotificationBell } from '@notifydesk/widget'

export function AppHeader() {
  return (
    <header>
      {/* ...내비게이션... */}
      <NotificationBell
        recipientId="${recipientId}"
        publishableKey="${publishableKey}"
        endpoint="${base}"${accentProp}
      />
    </header>
  )
}`
}

/** 비-React 사이트: IIFE 스크립트 + init 한 줄(publishable 키). */
export function vanillaSnippet({
  publishableKey,
  endpoint,
  recipientId = 'user_42',
  accent,
}: EmbedConfig): string {
  const base = cleanBase(endpoint)
  const accentLine = accent ? `,\n      accent: '${accent}'` : ''
  return `<!-- NotifyDesk 알림 벨 -->
<div id="notify-bell"></div>
<script src="${base}/notify-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    NotifyDesk.init({
      target: '#notify-bell',
      recipientId: '${recipientId}',
      publishableKey: '${publishableKey}',
      endpoint: '${base}'${accentLine}
    })
  })
</script>`
}

/** 서버(Node/엣지): secret 키로 발송 — @notifydesk/sdk. */
export function serverSendSnippet({
  endpoint,
  recipientId = 'user_42',
}: {
  endpoint: string
  recipientId?: string
}): string {
  const base = cleanBase(endpoint)
  return `import { createNotifyDeskClient } from '@notifydesk/sdk'

const notify = createNotifyDeskClient({
  secretKey: process.env.NOTIFYDESK_SECRET_KEY, // sk_… (서버 환경변수, 브라우저 노출 금지)
  endpoint: '${base}',
})

// 템플릿 발송
await notify.notify('${recipientId}', {
  type: 'order.shipped',
  templateKey: 'order.shipped',
  data: { name: '지은', orderId: 'A-1024', carrier: 'CJ대한통운' },
  email: 'user@example.com',
})

// 애드혹(템플릿 없이) 발송
await notify.notify('${recipientId}', {
  type: 'system',
  title: '환영합니다',
  body: '가입을 축하해요!',
})`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `# 브라우저(인박스 벨)
npm i @notifydesk/widget
# 서버(발송)
npm i @notifydesk/sdk`
}
