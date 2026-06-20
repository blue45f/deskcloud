import { describe, expect, it } from 'vitest'

import { installSnippet, reactSnippet, vanillaSnippet } from './embed'

const cfg = {
  publishableKey: 'pk_demo',
  endpoint: 'https://changelog.example.com/',
  accent: '#2f5fe0',
}

describe('embed snippets', () => {
  it('reactSnippet 은 pk·정규화된 endpoint·accent 를 담는다', () => {
    const out = reactSnippet(cfg)
    expect(out).toContain("import { ChangelogWidget } from '@changelogdesk/widget'")
    expect(out).toContain('publishableKey="pk_demo"')
    // 끝의 슬래시는 제거된다.
    expect(out).toContain('endpoint="https://changelog.example.com"')
    expect(out).not.toContain('example.com/"')
    expect(out).toContain('accent="#2f5fe0"')
  })

  it('reactSnippet 은 accent 가 없으면 accent prop 을 생략한다', () => {
    const out = reactSnippet({ publishableKey: 'pk_x', endpoint: 'http://localhost:4095' })
    expect(out).not.toContain('accent=')
  })

  it('vanillaSnippet 은 IIFE 스크립트 + init 한 줄', () => {
    const out = vanillaSnippet(cfg)
    expect(out).toContain('changelog-widget.js')
    expect(out).toContain("ChangelogDesk.init({ publishableKey: 'pk_demo'")
    expect(out).toContain("endpoint: 'https://changelog.example.com'")
    expect(out).toContain("accent: '#2f5fe0'")
  })

  it('vanillaSnippet 은 accent 가 없으면 accent 옵션을 생략한다', () => {
    const out = vanillaSnippet({ publishableKey: 'pk_x', endpoint: 'http://localhost:4095' })
    expect(out).not.toContain('accent:')
  })

  it('installSnippet 은 패키지명을 포함한다', () => {
    expect(installSnippet()).toContain('@changelogdesk/widget')
  })
})
