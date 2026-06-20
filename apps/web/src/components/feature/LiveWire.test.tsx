import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LiveWire } from './LiveWire'

/**
 * LiveWire 는 히어로의 시그니처 데모(WebSocket pub/sub·presence 를 *보여 준다*).
 * jsdom 에 matchMedia 가 없으므로 명시적으로 스텁한다. reduced-motion 을 켜면
 * 흐름 타이머 없이 정적 스냅샷(채널·presence·서버 publish 한 줄)을 렌더한다 —
 * 빈 화면이 되지 않음을 보장한다.
 */
function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LiveWire', () => {
  beforeEach(() => stubMatchMedia(true))

  it('reduced-motion 에서도 채널·라이브 상태·서버 publish 스니펫을 렌더한다', () => {
    render(<LiveWire />)
    // 채널 이름과 LIVE 표시 — 정적 스냅샷에서도 항상 보인다.
    expect(screen.getAllByText('room:lobby').length).toBeGreaterThan(0)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
    // presence 수치(접속자)와 서버 publish 한 줄.
    expect(screen.getByText(/명 접속/)).toBeInTheDocument()
    expect(screen.getByText(/pub\.publish\(/)).toBeInTheDocument()
  })

  it('시드 메시지를 비워 두지 않는다(빈 데모 방지)', () => {
    render(<LiveWire />)
    // 시드 메시지 중 하나가 보여야 한다(스트림이 비어 보이지 않도록).
    expect(screen.getByText('doc:design 잠금 해제')).toBeInTheDocument()
  })
})
