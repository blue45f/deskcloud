/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <CommunityBoard> / <CommunityFeed> 를 (재)마운트한다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 */
import { StrictMode, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { CommunityBoard, CommunityFeed } from '../src/react'

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    boardSlug: 'free',
    endpoint: 'http://localhost:4096',
    publishableKey: 'pk_demo',
    accent: '#2f5fe0',
    memberId: 'demo-user',
    memberName: '데모 사용자',
    nonce: 0,
  })

  const sync = () =>
    setConfig((c) => ({
      boardSlug: readInput('boardSlug') || 'free',
      endpoint: readInput('endpoint') || 'http://localhost:4096',
      publishableKey: readInput('publishableKey') || 'pk_demo',
      accent: readInput('accent') || '#2f5fe0',
      memberId: readInput('memberId'),
      memberName: readInput('memberName') || '데모 사용자',
      nonce: c.nonce + 1,
    }))

  if (typeof window !== 'undefined' && !(window as { __cdBound?: boolean }).__cdBound) {
    ;(window as { __cdBound?: boolean }).__cdBound = true
    for (const id of ['boardSlug', 'endpoint', 'publishableKey', 'accent', 'memberId', 'memberName']) {
      document.getElementById(id)?.addEventListener('change', sync)
    }
  }

  const common = {
    publishableKey: config.publishableKey,
    endpoint: config.endpoint,
    accent: config.accent,
    boardSlug: config.boardSlug,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 24, alignItems: 'start' }}>
      <CommunityBoard
        key={`board-${config.nonce}`}
        {...common}
        memberId={config.memberId || undefined}
        memberName={config.memberName}
      />
      <CommunityFeed
        key={`feed-${config.nonce}`}
        {...common}
        limit={5}
        title="최근 글"
        onOpenPost={(p) => console.info('[demo] feed open', p.id, p.title)}
      />
    </div>
  )
}

const host = document.getElementById('app') ?? document.body.appendChild(document.createElement('div'))
createRoot(host).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
