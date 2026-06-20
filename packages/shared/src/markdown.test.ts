import { describe, expect, it } from 'vitest'

import { escapeHtml, markdownToSafeHtml } from './markdown'

describe('escapeHtml', () => {
  it('HTML 특수문자를 이스케이프', () => {
    expect(escapeHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;')
    expect(escapeHtml(`"' & <`)).toBe('&quot;&#39; &amp; &lt;')
  })
})

describe('markdownToSafeHtml — XSS 차단', () => {
  it('raw script 태그를 무력화', () => {
    const html = markdownToSafeHtml('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('이미지 onerror 등 raw HTML 속성 주입 차단', () => {
    const html = markdownToSafeHtml('<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('javascript: 링크 스킴 제거(텍스트만 남김)', () => {
    const html = markdownToSafeHtml('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<a ')
    expect(html).toContain('click')
  })

  it('안전한 http 링크는 rel/target 강제하여 허용', () => {
    const html = markdownToSafeHtml('[docs](https://example.com)')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
    expect(html).toContain('target="_blank"')
  })
})

describe('markdownToSafeHtml — 마크다운 렌더', () => {
  it('제목·강조·인라인 코드', () => {
    expect(markdownToSafeHtml('# Title')).toContain('<h1>Title</h1>')
    expect(markdownToSafeHtml('**bold**')).toContain('<strong>bold</strong>')
    expect(markdownToSafeHtml('*it*')).toContain('<em>it</em>')
    expect(markdownToSafeHtml('`code`')).toContain('<code>code</code>')
  })

  it('순서 없는/있는 목록', () => {
    const ul = markdownToSafeHtml('- a\n- b')
    expect(ul).toContain('<ul>')
    expect(ul).toContain('<li>a</li>')
    const ol = markdownToSafeHtml('1. one\n2. two')
    expect(ol).toContain('<ol>')
    expect(ol).toContain('<li>one</li>')
  })

  it('단락과 코드펜스', () => {
    expect(markdownToSafeHtml('hello world')).toContain('<p>hello world</p>')
    const fenced = markdownToSafeHtml('```\nconst x = 1\n```')
    expect(fenced).toContain('<pre><code>')
    expect(fenced).toContain('const x = 1')
  })

  it('코드펜스 안의 raw HTML 도 이스케이프', () => {
    const html = markdownToSafeHtml('```\n<script>x</script>\n```')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
