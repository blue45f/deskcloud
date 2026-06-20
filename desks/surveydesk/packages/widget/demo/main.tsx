/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <FeedbackWidget> 을 (재)마운트한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 */
import { StrictMode, useCallback, useEffect, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { FeedbackWidget, type WidgetPosition } from '../src/react'

const CONTROL_IDS = ['appId', 'endpoint', 'accent', 'position'] as const

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    appId: 'demo',
    endpoint: 'http://localhost:4090',
    accent: '#2f5fe0',
    position: 'bottom-right' as WidgetPosition,
    nonce: 0,
  })

  // 컨트롤 변경 시 위젯을 재마운트(key=nonce)
  const sync = useCallback(
    () =>
      setConfig((c) => ({
        appId: readInput('appId') || 'demo',
        endpoint: readInput('endpoint') || 'http://localhost:4090',
        accent: readInput('accent') || '#2f5fe0',
        position: (readInput('position') as WidgetPosition) || 'bottom-right',
        nonce: c.nonce + 1,
      })),
    []
  )

  // 입력 이벤트 바인딩 — 마운트 시 1회(외부 DOM 폼 컨트롤 구독).
  useEffect(() => {
    const els = CONTROL_IDS.map((id) => document.getElementById(id))
    els.forEach((el) => el?.addEventListener('change', sync))
    return () => els.forEach((el) => el?.removeEventListener('change', sync))
  }, [sync])

  return (
    <FeedbackWidget
      key={config.nonce}
      appId={config.appId}
      endpoint={config.endpoint}
      accent={config.accent}
      position={config.position}
      onSubmitted={(r) => console.info('[demo] submitted', r)}
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
