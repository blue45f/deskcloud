import { describe, expect, it } from 'vitest'

import { reactSnippet, vanillaSnippet } from './embed'

describe('embed 스니펫 생성기', () => {
  it('vanilla 스니펫은 IIFE 스크립트 + init 호출을 담고 endpoint 끝 슬래시를 정규화한다', () => {
    const out = vanillaSnippet({ appId: 'offhours', endpoint: 'https://surveys.example.com/' })
    expect(out).toContain('src="https://surveys.example.com/feedback-widget.js"')
    expect(out).toContain("SurveyDesk.init({ appId: 'offhours', endpoint: 'https://surveys.example.com' })")
    // 끝 슬래시가 중복되지 않아야 함
    expect(out).not.toContain('surveys.example.com//')
  })

  it('accent 가 있으면 vanilla 스니펫에 accent 옵션을 추가한다', () => {
    const out = vanillaSnippet({ appId: 'demo', endpoint: 'http://localhost:4090', accent: '#e0562f' })
    expect(out).toContain("accent: '#e0562f'")
  })

  it('react 스니펫은 FeedbackWidget 컴포넌트와 props 를 담는다', () => {
    const out = reactSnippet({ appId: 'resume', endpoint: 'https://s.example.com', accent: '#2f5fe0' })
    expect(out).toContain('<FeedbackWidget')
    expect(out).toContain('appId="resume"')
    expect(out).toContain('endpoint="https://s.example.com"')
    expect(out).toContain('accent="#2f5fe0"')
  })

  it('accent 가 없으면 react 스니펫에 accent prop 을 넣지 않는다', () => {
    const out = reactSnippet({ appId: 'demo', endpoint: 'http://localhost:4090' })
    expect(out).not.toContain('accent=')
  })
})
