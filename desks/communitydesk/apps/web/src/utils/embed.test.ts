import { describe, expect, it } from 'vitest'

import { adminSnippet, installSnippet, reactSnippet, vanillaSnippet } from './embed'

const cfg = {
  publishableKey: 'pk_demo',
  endpoint: 'https://community.example.com/',
  boardSlug: 'free',
  accent: '#2f5fe0',
}

describe('embed snippets', () => {
  it('vanillaSnippet 은 끝의 슬래시를 정규화하고 키·보드·강조색을 담는다', () => {
    const s = vanillaSnippet(cfg)
    expect(s).toContain("publishableKey: 'pk_demo'")
    expect(s).toContain("boardSlug: 'free'")
    expect(s).toContain("accent: '#2f5fe0'")
    expect(s).toContain('https://community.example.com/community-widget.js')
    // 끝 슬래시는 한 번만 정규화되어 중복 슬래시가 없어야 한다.
    expect(s).not.toContain('com//community-widget.js')
  })

  it('reactSnippet 은 컴포넌트와 props 를 담는다', () => {
    const s = reactSnippet(cfg)
    expect(s).toContain('<CommunityBoard')
    expect(s).toContain('publishableKey="pk_demo"')
    expect(s).toContain('boardSlug="free"')
    expect(s).toContain('accent="#2f5fe0"')
    expect(s).toContain("from '@communitydesk/widget'")
  })

  it('accent 가 없으면 accent 라인을 생략한다', () => {
    const s = reactSnippet({ ...cfg, accent: undefined })
    expect(s).not.toContain('accent=')
  })

  it('adminSnippet 은 secret 키를 환경변수로 쓰고 브라우저 노출을 경고한다', () => {
    const s = adminSnippet({ endpoint: cfg.endpoint })
    expect(s).toContain('createCommunityAdminClient')
    expect(s).toContain('process.env.COMMUNITYDESK_SECRET_KEY')
    expect(s).toContain('moderatePost')
  })

  it('installSnippet 은 위젯 패키지를 설치한다', () => {
    expect(installSnippet()).toContain('@communitydesk/widget')
  })
})
