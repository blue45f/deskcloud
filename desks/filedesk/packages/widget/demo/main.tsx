/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <FileUpload> 를 (재)마운트한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 */
import { StrictMode, useEffect, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { FileUpload } from '../src/react'

const INPUT_IDS = ['publishableKey', 'endpoint', 'accent', 'visibility'] as const

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    publishableKey: 'pk_demo',
    endpoint: 'http://localhost:4100',
    accent: '#2f5fe0',
    visibility: 'public' as 'public' | 'private',
    nonce: 0,
  })

  // 컨트롤 변경 시 위젯을 재마운트(key=nonce). 리스너는 effect 에서 등록/해제.
  useEffect(() => {
    const sync = (): void =>
      setConfig((c) => ({
        publishableKey: readInput('publishableKey') || 'pk_demo',
        endpoint: readInput('endpoint') || 'http://localhost:4100',
        accent: readInput('accent') || '#2f5fe0',
        visibility: (readInput('visibility') as 'public' | 'private') || 'public',
        nonce: c.nonce + 1,
      }))
    const nodes = INPUT_IDS.map((id) => document.getElementById(id))
    for (const node of nodes) node?.addEventListener('change', sync)
    return () => {
      for (const node of nodes) node?.removeEventListener('change', sync)
    }
  }, [])

  return (
    <FileUpload
      key={config.nonce}
      publishableKey={config.publishableKey}
      endpoint={config.endpoint}
      accent={config.accent}
      visibility={config.visibility}
      onUploaded={(f) => console.info('[demo] uploaded', f.key, f.url)}
      onError={(e) => console.warn('[demo] error', e.message)}
    />
  )
}

const host = document.getElementById('upload-host') ?? document.body
createRoot(host).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
