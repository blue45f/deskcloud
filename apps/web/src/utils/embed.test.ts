import { describe, expect, it } from 'vitest'

import {
  indexSnippet,
  installSnippet,
  reactBoxSnippet,
  reactPaletteSnippet,
  vanillaSnippet,
} from './embed'

const cfg = {
  publishableKey: 'pk_demo',
  endpoint: 'https://search.example.com/',
  accent: '#2f5fe0',
  index: 'docs',
}

describe('embed snippets', () => {
  it('vanilla: 트레일링 슬래시를 정규화하고 init 한 줄을 만든다', () => {
    const s = vanillaSnippet(cfg)
    expect(s).toContain('search-widget.js')
    expect(s).toContain("publishableKey: 'pk_demo'")
    expect(s).toContain("endpoint: 'https://search.example.com'")
    expect(s).not.toContain('example.com//')
    expect(s).toContain("accent: '#2f5fe0'")
    expect(s).toContain("indexName: 'docs'")
  })

  it('react palette: SearchPalette 컴포넌트를 임포트한다', () => {
    const s = reactPaletteSnippet(cfg)
    expect(s).toContain("import { SearchPalette } from '@searchdesk/widget'")
    expect(s).toContain('publishableKey="pk_demo"')
    expect(s).toContain('indexName="docs"')
  })

  it('react box: SearchBox 컴포넌트를 임포트한다', () => {
    const s = reactBoxSnippet(cfg)
    expect(s).toContain("import { SearchBox } from '@searchdesk/widget'")
  })

  it('index snippet: secret 키를 환경변수로 쓰고 경고를 단다', () => {
    const s = indexSnippet({ endpoint: cfg.endpoint, index: 'docs' })
    expect(s).toContain('createIndexer')
    expect(s).toContain('SEARCHDESK_SECRET_KEY')
    expect(s).toContain('서버에서만')
  })

  it('install snippet: 위젯·sdk 패키지를 모두 설치한다', () => {
    const s = installSnippet()
    expect(s).toContain('@searchdesk/widget')
    expect(s).toContain('@searchdesk/sdk')
  })

  it('accent/index 가 없으면 옵션 라인을 생략한다', () => {
    const s = vanillaSnippet({ publishableKey: 'pk_x', endpoint: 'https://s.example.com' })
    expect(s).not.toContain('accent:')
    expect(s).not.toContain('indexName:')
  })
})
