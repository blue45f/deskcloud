/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <AuthForm> 을 (재)마운트한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 */
import { StrictMode, useEffect, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { AuthForm } from '../src/react'

const INPUT_IDS = ['publishableKey', 'endpoint', 'accent', 'mode'] as const

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    publishableKey: 'pk_demo',
    endpoint: 'http://localhost:4110',
    accent: '#2f5fe0',
    mode: 'login' as 'login' | 'register',
    nonce: 0,
  })

  // 컨트롤 변경 시 위젯을 재마운트(key=nonce). 리스너는 effect 에서 등록/해제.
  useEffect(() => {
    const sync = (): void =>
      setConfig((c) => ({
        publishableKey: readInput('publishableKey') || 'pk_demo',
        endpoint: readInput('endpoint') || 'http://localhost:4110',
        accent: readInput('accent') || '#2f5fe0',
        mode: (readInput('mode') as 'login' | 'register') || 'login',
        nonce: c.nonce + 1,
      }))
    const nodes = INPUT_IDS.map((id) => document.getElementById(id))
    for (const node of nodes) node?.addEventListener('change', sync)
    return () => {
      for (const node of nodes) node?.removeEventListener('change', sync)
    }
  }, [])

  return (
    <AuthForm
      key={config.nonce}
      publishableKey={config.publishableKey}
      endpoint={config.endpoint}
      accent={config.accent}
      initialMode={config.mode}
      storage="memory"
      onAuthenticated={(r) => console.info('[demo] authenticated', r.user.email)}
      onSignOut={() => console.info('[demo] signed out')}
      onError={(e) => console.warn('[demo] error', e.message)}
    />
  )
}

const host = document.getElementById('form-host') ?? document.body
createRoot(host).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
