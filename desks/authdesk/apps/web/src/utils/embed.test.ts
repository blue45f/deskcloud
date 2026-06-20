import { describe, expect, it } from 'vitest'

import { reactSnippet, sdkSnippet, vanillaSnippet } from './embed'

describe('embed 스니펫 생성기', () => {
  it('vanilla 스니펫은 IIFE 스크립트 + init 호출을 담고 endpoint 끝 슬래시를 정규화한다', () => {
    const out = vanillaSnippet({ publishableKey: 'pk_demo', endpoint: 'https://auth.example.com/' })
    expect(out).toContain('src="https://auth.example.com/authdesk-widget.js"')
    expect(out).toContain("publishableKey: 'pk_demo'")
    expect(out).toContain("endpoint: 'https://auth.example.com'")
    expect(out).not.toContain('auth.example.com//')
  })

  it('accent 가 있으면 vanilla 스니펫에 accent 옵션을 추가한다', () => {
    const out = vanillaSnippet({ publishableKey: 'pk_x', endpoint: 'http://localhost:4110', accent: '#e0562f' })
    expect(out).toContain("accent: '#e0562f'")
  })

  it('react 스니펫은 AuthForm 컴포넌트와 props 를 담는다', () => {
    const out = reactSnippet({ publishableKey: 'pk_y', endpoint: 'https://a.example.com', accent: '#2f5fe0' })
    expect(out).toContain('<AuthForm')
    expect(out).toContain('publishableKey="pk_y"')
    expect(out).toContain('endpoint="https://a.example.com"')
    expect(out).toContain('accent="#2f5fe0"')
  })

  it('accent 가 없으면 react 스니펫에 accent prop 을 넣지 않는다', () => {
    const out = reactSnippet({ publishableKey: 'pk_z', endpoint: 'http://localhost:4110' })
    expect(out).not.toContain('accent=')
  })

  it('sdk 스니펫은 createAuthDeskClient 와 핵심 메서드를 담는다', () => {
    const out = sdkSnippet({ publishableKey: 'pk_s', endpoint: 'https://a.example.com/' })
    expect(out).toContain('createAuthDeskClient')
    expect(out).toContain("publishableKey: 'pk_s'")
    expect(out).toContain('auth.register')
    expect(out).toContain('auth.getSession')
    expect(out).toContain('auth.logout')
  })
})
