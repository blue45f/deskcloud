/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <NotificationBell> 을 (재)마운트한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 */
import { StrictMode, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { NotificationBell } from '../src/react'

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    recipientId: 'user_demo',
    publishableKey: 'pk_demo',
    endpoint: 'http://localhost:4095',
    accent: '#2f5fe0',
    nonce: 0,
  })

  // 컨트롤 변경 시 위젯을 재마운트(key=nonce)
  const sync = (): void =>
    setConfig((c) => ({
      recipientId: readInput('recipientId') || 'user_demo',
      publishableKey: readInput('publishableKey') || 'pk_demo',
      endpoint: readInput('endpoint') || 'http://localhost:4095',
      accent: readInput('accent') || '#2f5fe0',
      nonce: c.nonce + 1,
    }))

  // 입력 이벤트 바인딩(한 번만)
  if (typeof window !== 'undefined' && !(window as { __ndBound?: boolean }).__ndBound) {
    ;(window as { __ndBound?: boolean }).__ndBound = true
    for (const id of ['recipientId', 'publishableKey', 'endpoint', 'accent']) {
      document.getElementById(id)?.addEventListener('change', sync)
    }
  }

  return (
    <NotificationBell
      key={config.nonce}
      recipientId={config.recipientId}
      publishableKey={config.publishableKey}
      endpoint={config.endpoint}
      accent={config.accent}
      pollIntervalMs={15_000}
      onNotificationClick={(n) => console.info('[demo] clicked', n.id, n.title)}
      onUnreadChange={(n) => console.info('[demo] unread', n)}
    />
  )
}

const host = document.getElementById('bell-host') ?? document.body
createRoot(host).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
