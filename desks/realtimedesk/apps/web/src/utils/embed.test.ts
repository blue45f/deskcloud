import { describe, expect, it } from 'vitest'

import {
  clientSnippet,
  curlSnippet,
  hookSnippet,
  reactSnippet,
  serverSnippet,
  vanillaSnippet,
} from './embed'

const cfg = {
  publishableKey: 'pk_abc123',
  endpoint: 'https://realtime.example.com/',
  channel: 'room:42',
}

describe('embed snippets', () => {
  it('vanilla 스니펫은 위젯 로더·init·끝슬래시 제거된 endpoint 를 포함한다', () => {
    const out = vanillaSnippet(cfg)
    expect(out).toContain('/realtime-widget.js')
    expect(out).toContain("RealtimeDesk.init(")
    expect(out).toContain('https://realtime.example.com')
    expect(out).not.toContain('example.com//')
    expect(out).toContain('pk_abc123')
    expect(out).toContain('room:42')
  })

  it('react 스니펫은 PresenceBar 와 pk/endpoint 를 포함한다', () => {
    const out = reactSnippet(cfg)
    expect(out).toContain('@realtimedesk/widget/react')
    expect(out).toContain('PresenceBar')
    expect(out).toContain('pk_abc123')
  })

  it('hook 스니펫은 useRealtime 을 쓴다', () => {
    expect(hookSnippet(cfg)).toContain('useRealtime')
  })

  it('client 스니펫은 createRealtimeClient·subscribe 를 포함한다', () => {
    const out = clientSnippet(cfg)
    expect(out).toContain('createRealtimeClient')
    expect(out).toContain("subscribe('room:42'")
  })

  it('server 스니펫은 sk 를 하드코딩하지 않고 env 를 쓴다', () => {
    const out = serverSnippet(cfg)
    expect(out).toContain('createPublisher')
    expect(out).toContain('process.env')
    expect(out).not.toContain('pk_abc123')
  })

  it('curl 스니펫은 publish 엔드포인트와 X-Realtime-Key 를 쓴다', () => {
    const out = curlSnippet(cfg)
    expect(out).toContain('/api/publish')
    expect(out).toContain('X-Realtime-Key: sk_')
  })

  it('빈 pk 면 플레이스홀더로 대체된다', () => {
    const out = reactSnippet({ publishableKey: '', endpoint: 'http://x' })
    expect(out).toContain('pk_여기에_publishable_키')
  })
})
