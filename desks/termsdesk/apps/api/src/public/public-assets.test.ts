import { describe, expect, it } from 'vitest'

import { renderPolicyDocument } from './public-assets'

import type { PublicRenderDto } from '@termsdesk/shared'

const baseDto: PublicRenderDto = {
  orgName: 'Rotifolk',
  policySlug: 'terms-of-service',
  name: '이용약관',
  type: 'terms',
  locale: 'ko',
  versionId: 'v-1',
  versionLabel: 'v1',
  contentHash: 'a'.repeat(64),
  body: '제1조 (목적)\n본 약관은 …',
  effectiveAt: null,
  publishedAt: null,
  changeSummary: null,
  availableVersions: ['v1'],
  unresolvedVars: [],
}

describe('renderPolicyDocument 헤더 아이콘', () => {
  it('renders the org logo image inside the header icon when orgLogoUrl is http(s)', () => {
    const html = renderPolicyDocument({
      ...baseDto,
      orgLogoUrl: 'https://rotifolk.example.com/icon.png',
    })

    expect(html).toContain('class="tdk-icon"')
    expect(html).toContain('<img src="https://rotifolk.example.com/icon.png"')
    // 로드 실패 시 모노그램이 비쳐 보이는 무JS 폴백 — 이니셜이 항상 함께 출력된다.
    expect(html).toContain('>R<img')
  })

  it('falls back to the initial monogram when no logo is set', () => {
    const html = renderPolicyDocument(baseDto)

    expect(html).toContain('class="tdk-icon"')
    expect(html).toContain('>R</span>')
    expect(html).not.toContain('<img')
  })

  it('defensively ignores non-http(s) logo URLs (data:/javascript:)', () => {
    for (const orgLogoUrl of ['data:image/svg+xml;base64,PHN2Zy8+', 'javascript:alert(1)']) {
      const html = renderPolicyDocument({ ...baseDto, orgLogoUrl })
      expect(html).not.toContain('<img')
    }
  })

  it('escapes html metacharacters in the logo URL attribute', () => {
    const html = renderPolicyDocument({
      ...baseDto,
      orgLogoUrl: 'https://e.com/a.png?x="><script>1</script>',
    })

    expect(html).not.toContain('"><script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })
})

describe('renderPolicyDocument 본문 불릿 목록', () => {
  it('groups consecutive `- `/`* ` lines into one <ul>', () => {
    const html = renderPolicyDocument({
      ...baseDto,
      body: '제1조 (목적)\n- 첫째 항목\n* 둘째 항목\n일반 문단',
    })

    expect(html).toContain('<ul class="tdk-ul">')
    expect(html).toContain('<li class="tdk-li">첫째 항목</li>')
    expect(html).toContain('<li class="tdk-li">둘째 항목</li>')
    // 그룹은 하나 — 불릿 두 줄이 같은 <ul> 안에 들어간다.
    expect(html.split('<ul class="tdk-ul">')).toHaveLength(2)
    expect(html).toContain('<p class="tdk-p">일반 문단</p>')
  })

  it('closes the list on a blank line and starts a new one after', () => {
    const html = renderPolicyDocument({
      ...baseDto,
      body: '- 하나\n\n- 둘',
    })

    expect(html.split('<ul class="tdk-ul">')).toHaveLength(3)
  })

  it('escapes html inside bullet items', () => {
    const html = renderPolicyDocument({
      ...baseDto,
      body: '- <script>alert(1)</script>',
    })

    expect(html).not.toContain('<script>')
    expect(html).toContain('<li class="tdk-li">&lt;script&gt;alert(1)&lt;/script&gt;</li>')
  })

  it('keeps hyphenated prose lines as paragraphs (no false bullets)', () => {
    const html = renderPolicyDocument({
      ...baseDto,
      body: '-기호로 시작하지만 공백이 없는 줄',
    })

    expect(html).not.toContain('<ul')
    expect(html).toContain('<p class="tdk-p">-기호로 시작하지만 공백이 없는 줄</p>')
  })
})
