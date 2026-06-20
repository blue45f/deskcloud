/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <ChatWidget> 을 (재)마운트한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 * 로컬 API(:4094)에 붙어 시드된 demo 테넌트(pk_demo)의 DM·그룹 대화를 보여준다.
 */
import { StrictMode, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { ChatWidget, type WidgetPosition } from '../src/react'

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    publishableKey: 'pk_demo',
    endpoint: 'http://localhost:4094',
    memberId: 'alice',
    accent: '#2f5fe0',
    position: 'bottom-right' as WidgetPosition,
    nonce: 0,
  })

  const sync = (): void =>
    setConfig((c) => ({
      publishableKey: readInput('publishableKey') || 'pk_demo',
      endpoint: readInput('endpoint') || 'http://localhost:4094',
      memberId: readInput('memberId') || 'alice',
      accent: readInput('accent') || '#2f5fe0',
      position: (readInput('position') as WidgetPosition) || 'bottom-right',
      nonce: c.nonce + 1,
    }))

  if (typeof window !== 'undefined' && !(window as { __cdBound?: boolean }).__cdBound) {
    ;(window as { __cdBound?: boolean }).__cdBound = true
    for (const id of ['publishableKey', 'endpoint', 'memberId', 'accent', 'position']) {
      document.getElementById(id)?.addEventListener('change', sync)
    }
  }

  return (
    <ChatWidget
      key={config.nonce}
      publishableKey={config.publishableKey}
      endpoint={config.endpoint}
      memberId={config.memberId}
      accent={config.accent}
      position={config.position}
    />
  )
}

const host = document.createElement('div')
document.body.appendChild(host)
createRoot(host).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
