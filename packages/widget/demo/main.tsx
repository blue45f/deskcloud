/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <ChangelogWidget> 을 (재)마운트한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 */
import { StrictMode, useEffect, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { ChangelogWidget, type WidgetPosition } from '../src/react'

const DEFAULTS = {
  publishableKey: 'pk_demo',
  endpoint: 'http://localhost:4095',
  accent: '#2f5fe0',
  position: 'bottom-right' as WidgetPosition,
}

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({ ...DEFAULTS, nonce: 0 })

  // 컨트롤 변경 시 위젯을 재마운트(key=nonce). 입력 이벤트 바인딩은 마운트 시 한 번만.
  useEffect(() => {
    const sync = () =>
      setConfig((c) => ({
        publishableKey: readInput('publishableKey') || DEFAULTS.publishableKey,
        endpoint: readInput('endpoint') || DEFAULTS.endpoint,
        accent: readInput('accent') || DEFAULTS.accent,
        position: (readInput('position') as WidgetPosition) || DEFAULTS.position,
        nonce: c.nonce + 1,
      }))
    const ids = ['publishableKey', 'endpoint', 'accent', 'position']
    const els = ids.map((id) => document.getElementById(id))
    els.forEach((el) => el?.addEventListener('change', sync))
    return () => els.forEach((el) => el?.removeEventListener('change', sync))
  }, [])

  return (
    <ChangelogWidget
      key={config.nonce}
      publishableKey={config.publishableKey}
      endpoint={config.endpoint}
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
