import { describe, expect, it } from 'vitest'

import { installSnippet, reactSnippet, serverSnippet, vanillaSnippet } from './embed'

describe('embed snippets', () => {
  const cfg = {
    publishableKey: 'pk_abc123',
    endpoint: 'https://chat.example.com/',
    memberId: 'alice',
    accent: '#2f5fe0',
  }

  it('vanilla 스니펫은 트레일링 슬래시를 제거하고 pk·memberId·accent 를 포함한다', () => {
    const s = vanillaSnippet(cfg)
    expect(s).toContain("publishableKey: 'pk_abc123'")
    expect(s).toContain("memberId: 'alice'")
    expect(s).toContain("accent: '#2f5fe0'")
    expect(s).toContain('https://chat.example.com/chat-widget.js')
    expect(s).not.toContain('.com//chat-widget')
  })

  it('react 스니펫은 ChatWidget 컴포넌트와 props 를 포함한다', () => {
    const s = reactSnippet(cfg)
    expect(s).toContain("import { ChatWidget } from '@chatdesk/widget'")
    expect(s).toContain('publishableKey="pk_abc123"')
    expect(s).toContain('memberId="alice"')
    expect(s).toContain('accent="#2f5fe0"')
  })

  it('pk·memberId 가 없으면 플레이스홀더로 대체한다', () => {
    const s = reactSnippet({ publishableKey: '', endpoint: 'https://x.dev', memberId: '' })
    expect(s).toContain('pk_여기에_publishable_키')
    expect(s).toContain('current-user-id')
  })

  it('server 스니펫은 secret 키를 환경변수로만 쓰고 admin SDK 를 보여 준다', () => {
    const s = serverSnippet({ endpoint: 'https://chat.example.com' })
    expect(s).toContain("import { createChatAdmin } from '@chatdesk/sdk/admin'")
    expect(s).toContain('process.env.CHATDESK_SECRET_KEY')
    expect(s).toContain('createConversation')
  })

  it('install 스니펫은 위젯 패키지를 가리킨다', () => {
    expect(installSnippet()).toContain('@chatdesk/widget')
  })
})
