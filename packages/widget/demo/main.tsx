/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <AdSlot> 를 (재)마운트한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 */
import { StrictMode, useEffect, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { AdSlot } from '../src/react'

const INPUT_IDS = ['publishableKey', 'endpoint', 'accent', 'slot'] as const

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    publishableKey: 'pk_demo',
    endpoint: 'http://localhost:4096',
    accent: '#2f5fe0',
    slot: 'sidebar',
    nonce: 0,
  })

  // 컨트롤 변경 시 위젯을 재마운트(key=nonce). 리스너는 effect 에서 등록/해제.
  useEffect(() => {
    const sync = (): void =>
      setConfig((c) => ({
        publishableKey: readInput('publishableKey') || 'pk_demo',
        endpoint: readInput('endpoint') || 'http://localhost:4096',
        accent: readInput('accent') || '#2f5fe0',
        slot: readInput('slot') || 'sidebar',
        nonce: c.nonce + 1,
      }))
    const nodes = INPUT_IDS.map((id) => document.getElementById(id))
    for (const node of nodes) node?.addEventListener('change', sync)
    return () => {
      for (const node of nodes) node?.removeEventListener('change', sync)
    }
  }, [])

  return (
    <AdSlot
      key={config.nonce}
      slot={config.slot}
      publishableKey={config.publishableKey}
      endpoint={config.endpoint}
      accent={config.accent}
      onImpression={(id) => console.info('[demo] impression', id)}
      onClick={(id) => console.info('[demo] click', id)}
      onError={(e) => console.warn('[demo] error', e.message)}
    />
  )
}

const host = document.getElementById('slot-host') ?? document.body
createRoot(host).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
