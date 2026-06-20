import { describe, expect, it } from 'vitest'

import { reactSnippet, vanillaSnippet } from './embed'

describe('embed 스니펫 생성기', () => {
  it('vanilla 스니펫은 IIFE 스크립트 + init 호출을 담고 endpoint 끝 슬래시를 정규화한다', () => {
    const out = vanillaSnippet({
      publishableKey: 'pk_demo',
      endpoint: 'https://ads.example.com/',
      slot: 'sidebar',
    })
    expect(out).toContain('src="https://ads.example.com/addesk-widget.js"')
    expect(out).toContain("publishableKey: 'pk_demo'")
    expect(out).toContain("slot: 'sidebar'")
    expect(out).toContain("endpoint: 'https://ads.example.com'")
    expect(out).not.toContain('ads.example.com//')
  })

  it('accent 가 있으면 vanilla 스니펫에 accent 옵션을 추가한다', () => {
    const out = vanillaSnippet({
      publishableKey: 'pk_x',
      endpoint: 'http://localhost:4096',
      slot: 'feed',
      accent: '#e0562f',
    })
    expect(out).toContain("accent: '#e0562f'")
  })

  it('react 스니펫은 AdSlot 컴포넌트와 props 를 담는다', () => {
    const out = reactSnippet({
      publishableKey: 'pk_y',
      endpoint: 'https://a.example.com',
      slot: 'sidebar',
      accent: '#2f5fe0',
    })
    expect(out).toContain('<AdSlot')
    expect(out).toContain('slot="sidebar"')
    expect(out).toContain('publishableKey="pk_y"')
    expect(out).toContain('endpoint="https://a.example.com"')
    expect(out).toContain('accent="#2f5fe0"')
  })

  it('accent 가 없으면 react 스니펫에 accent prop 을 넣지 않는다', () => {
    const out = reactSnippet({
      publishableKey: 'pk_z',
      endpoint: 'http://localhost:4096',
      slot: 'sidebar',
    })
    expect(out).not.toContain('accent=')
  })
})
