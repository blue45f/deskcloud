/**
 * 임베드/통합 스니펫 생성기 — 랜딩·임베드 탭·가이드가 공유한다.
 * endpoint 는 RealtimeDesk API/WS 베이스 URL(공개 WS 핸드셰이크는 pk + Origin).
 */
export interface EmbedConfig {
  /** publishable 키(pk_…) — 브라우저 노출용. */
  publishableKey: string
  /** API/WS 베이스 URL. 끝의 / 는 무시. */
  endpoint: string
  /** 데모 채널. 기본 'room:lobby'. */
  channel?: string
}

const PLACEHOLDER_PK = 'pk_여기에_publishable_키'

function clean(cfg: EmbedConfig): { pk: string; base: string; channel: string } {
  return {
    pk: cfg.publishableKey || PLACEHOLDER_PK,
    base: cfg.endpoint.replace(/\/+$/, ''),
    channel: cfg.channel || 'room:lobby',
  }
}

/** 비-React 사이트: IIFE 스크립트 + init 한 줄(PresenceBar). */
export function vanillaSnippet(cfg: EmbedConfig): string {
  const { pk, base, channel } = clean(cfg)
  return `<!-- RealtimeDesk presence 위젯 -->
<div id="presence"></div>
<script src="${base}/realtime-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    RealtimeDesk.init({
      target: '#presence',
      channel: '${channel}',
      publishableKey: '${pk}',
      endpoint: '${base}'
    })
  })
</script>`
}

/** React 앱: 패키지 설치 후 컴포넌트 한 줄. */
export function reactSnippet(cfg: EmbedConfig): string {
  const { pk, base, channel } = clean(cfg)
  return `import { PresenceBar } from '@realtimedesk/widget/react'

export function Header() {
  return (
    <PresenceBar
      channel="${channel}"
      publishableKey="${pk}"
      endpoint="${base}"
    />
  )
}`
}

/** React 훅 — presence·메시지·연결 상태를 직접 다룰 때. */
export function hookSnippet(cfg: EmbedConfig): string {
  const { pk, base, channel } = clean(cfg)
  return `import { useRealtime } from '@realtimedesk/widget/react'

function Room() {
  const { status, presence, messages } = useRealtime('${channel}', {
    publishableKey: '${pk}',
    endpoint: '${base}',
  })
  return (
    <div>
      <p>{status} · {presence.count}명 접속</p>
      <ul>{messages.map((m) => <li key={m.id}>{m.event}</li>)}</ul>
    </div>
  )
}`
}

/** 브라우저 SDK — 프레임워크 없이 직접 구독. */
export function clientSnippet(cfg: EmbedConfig): string {
  const { pk, base, channel } = clean(cfg)
  return `import { createRealtimeClient } from '@realtimedesk/sdk'

const rt = createRealtimeClient({
  publishableKey: '${pk}',
  endpoint: '${base}',
})
await rt.connect()
rt.subscribe('${channel}', (msg) => console.log('received', msg))
rt.onPresence('${channel}', (p) => console.log(p.count, '접속 중'))`
}

/** 서버 publish(sk) — secret 키로 채널에 이벤트 발행(서버 환경 전용). */
export function serverSnippet(cfg: EmbedConfig): string {
  const { base, channel } = clean(cfg)
  return `import { createPublisher } from '@realtimedesk/sdk/server'

// secret 키는 서버 환경 변수로만. 절대 클라이언트에 노출하지 마세요.
const pub = createPublisher({
  secretKey: process.env.REALTIMEDESK_SECRET_KEY,
  endpoint: '${base}',
})
await pub.publish('${channel}', 'message', { text: 'hello' })`
}

/** 서버 publish — REST(curl). SDK 없이도 발행. */
export function curlSnippet(cfg: EmbedConfig): string {
  const { base, channel } = clean(cfg)
  return `curl -X POST ${base}/api/publish \\
  -H 'Content-Type: application/json' \\
  -H 'X-Realtime-Key: sk_여기에_secret_키' \\
  -d '{"channel":"${channel}","event":"message","data":{"text":"hello"}}'`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @realtimedesk/sdk @realtimedesk/widget
# 또는: pnpm add @realtimedesk/sdk @realtimedesk/widget`
}
