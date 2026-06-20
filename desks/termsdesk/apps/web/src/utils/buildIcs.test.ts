import { describe, expect, it } from 'vitest'

import { buildIcs } from './buildIcs'

function physicalLines(value: string): string[] {
  return value.split('\r\n').filter(Boolean)
}

describe('buildIcs (약관 시행일 ICS 내보내기)', () => {
  it('VCALENDAR/VEVENT 구조 + PRODID + UTC 타임스탬프를 생성한다', () => {
    const ics = buildIcs({
      uid: 'termsdesk-version-1',
      title: '[약관 시행] 이용약관 v3',
      startAt: '2026-07-01T00:00:00+09:00',
      endAt: '2026-07-01T01:00:00+09:00',
      url: 'https://terms.example.com/p/acme/terms-of-service?version=v3',
    })

    const lines = physicalLines(ics)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines.at(-1)).toBe('END:VCALENDAR')
    expect(lines).toContain('PRODID:-//TermsDesk//Effective Date Export//KO')
    expect(lines).toContain('UID:termsdesk-version-1')
    // KST 자정 시행 → UTC 로는 전날 15시
    expect(lines).toContain('DTSTART:20260630T150000Z')
    expect(lines).toContain('DTEND:20260630T160000Z')
    expect(lines).toContain('URL:https://terms.example.com/p/acme/terms-of-service?version=v3')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('TEXT 필드를 §3.3.11 규칙으로 이스케이프한다 (원문 CR/LF 누출 금지)', () => {
    const ics = buildIcs({
      uid: 'termsdesk-version-1',
      title: '개인정보, 처리방침; 개정',
      description: '첫 줄\r\n둘째 줄, 세미콜론; 백슬래시 \\',
      startAt: '2026-07-01T00:00:00+09:00',
      endAt: '2026-07-01T01:00:00+09:00',
    })

    const lines = physicalLines(ics)
    expect(lines.find((line) => line.startsWith('SUMMARY:'))).toBe(
      'SUMMARY:개인정보\\, 처리방침\\; 개정'
    )
    expect(lines.find((line) => line.startsWith('DESCRIPTION:'))).toBe(
      'DESCRIPTION:첫 줄\\n둘째 줄\\, 세미콜론\\; 백슬래시 \\\\'
    )
  })

  it('잘못된 날짜는 사용할 수 없는 캘린더 파일을 만들기 전에 throw 한다', () => {
    expect(() =>
      buildIcs({
        uid: 'termsdesk-version-1',
        title: '잘못된 시행일',
        startAt: 'not-a-date',
        endAt: '2026-07-01T01:00:00+09:00',
      })
    ).toThrow(/Invalid date/)
  })

  it('멀티바이트 content line 을 75 octets 이하로 folding 한다', () => {
    const ics = buildIcs({
      uid: 'termsdesk-version-1',
      title: '약관'.repeat(40),
      description: '시행'.repeat(45),
      location: '서울'.repeat(30),
      startAt: '2026-07-01T00:00:00+09:00',
      endAt: '2026-07-01T01:00:00+09:00',
    })

    const encoder = new TextEncoder()

    for (const line of physicalLines(ics)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
  })
})
