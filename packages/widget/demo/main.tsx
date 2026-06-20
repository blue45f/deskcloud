/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <SearchPalette>(⌘K) + <SearchBox>(인라인)를 렌더한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 *
 * 로컬 API 가 떠 있어야 한다: pnpm --filter @searchdesk/api run dev  (:4093, PGlite + 데모 시드)
 */
import { StrictMode, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { SearchBox } from '../src/SearchBox'
import { SearchPalette } from '../src/SearchPalette'

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    publishableKey: 'pk_demo',
    endpoint: 'http://localhost:4093',
    accent: '#2f5fe0',
    nonce: 0,
  })
  const [paletteOpen, setPaletteOpen] = useState(false)

  const sync = () =>
    setConfig((c) => ({
      publishableKey: readInput('publishableKey') || 'pk_demo',
      endpoint: readInput('endpoint') || 'http://localhost:4093',
      accent: readInput('accent') || '#2f5fe0',
      nonce: c.nonce + 1,
    }))

  if (typeof window !== 'undefined' && !(window as { __skBound?: boolean }).__skBound) {
    ;(window as { __skBound?: boolean }).__skBound = true
    for (const id of ['publishableKey', 'endpoint', 'accent']) {
      document.getElementById(id)?.addEventListener('change', sync)
    }
    document.getElementById('open-palette')?.addEventListener('click', () => setPaletteOpen(true))
  }

  return (
    <div key={config.nonce}>
      {/* 비제어 ⌘K 팔레트(전역 핫키) */}
      <SearchPalette
        publishableKey={config.publishableKey}
        endpoint={config.endpoint}
        accent={config.accent}
        onSelect={(hit) => console.info('[demo] palette select', hit.id, hit.url)}
      />

      {/* 제어 모드 데모 — 버튼으로 여는 별도 팔레트 인스턴스 */}
      <SearchPalette
        publishableKey={config.publishableKey}
        endpoint={config.endpoint}
        accent={config.accent}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(hit) => console.info('[demo] controlled select', hit.id, hit.url)}
      />

      {/* 인라인 검색 박스 */}
      <div id="box-mount">
        <SearchBox
          publishableKey={config.publishableKey}
          endpoint={config.endpoint}
          accent={config.accent}
          placeholder="인라인 검색…"
          onSelect={(hit) => console.info('[demo] box select', hit.id, hit.url)}
        />
      </div>
    </div>
  )
}

const host = document.getElementById('app') ?? document.body.appendChild(document.createElement('div'))
createRoot(host).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
