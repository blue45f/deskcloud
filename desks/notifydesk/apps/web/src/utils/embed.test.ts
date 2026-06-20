import { describe, expect, it } from 'vitest'

import { installSnippet, reactSnippet, serverSendSnippet, vanillaSnippet } from './embed'

const cfg = {
  publishableKey: 'pk_test123',
  endpoint: 'https://notify.example.com/',
  recipientId: 'user_7',
  accent: '#2f5fe0',
}

describe('embed snippets', () => {
  it('reactSnippet 은 publishable 키·endpoint·recipientId 를 포함하고 끝 슬래시를 정리한다', () => {
    const s = reactSnippet(cfg)
    expect(s).toContain('@notifydesk/widget')
    expect(s).toContain('NotificationBell')
    expect(s).toContain('pk_test123')
    expect(s).toContain('https://notify.example.com')
    expect(s).not.toContain('example.com/"') // trailing slash trimmed
    expect(s).toContain('user_7')
    expect(s).toContain('accent="#2f5fe0"')
  })

  it('reactSnippet 은 accent 없으면 accent prop 을 넣지 않는다', () => {
    const s = reactSnippet({ publishableKey: 'pk_x', endpoint: 'https://n.test' })
    expect(s).not.toContain('accent=')
  })

  it('vanillaSnippet 은 IIFE 스크립트 + NotifyDesk.init 을 만든다', () => {
    const s = vanillaSnippet(cfg)
    expect(s).toContain('notify-widget.js')
    expect(s).toContain('NotifyDesk.init')
    expect(s).toContain("publishableKey: 'pk_test123'")
    expect(s).toContain("accent: '#2f5fe0'")
  })

  it('serverSendSnippet 은 secret 키를 env 에서만 읽고 SDK 를 쓴다', () => {
    const s = serverSendSnippet({ endpoint: 'https://notify.example.com', recipientId: 'user_7' })
    expect(s).toContain('@notifydesk/sdk')
    expect(s).toContain('process.env.NOTIFYDESK_SECRET_KEY')
    expect(s).toContain('user_7')
    // secret 키 "값"을 박지 않는다(키는 env 로만; 'sk_…' 주석 안내는 허용).
    expect(s).not.toMatch(/secretKey:\s*['"]sk_/)
  })

  it('installSnippet 은 widget·sdk 둘 다 안내한다', () => {
    const s = installSnippet()
    expect(s).toContain('@notifydesk/widget')
    expect(s).toContain('@notifydesk/sdk')
  })
})
