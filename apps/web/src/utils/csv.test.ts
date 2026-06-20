import { describe, expect, it } from 'vitest'

import { csvCell, csvFilename, respondentLabel, responsesToCsv } from './csv'

import type { ResponseDto, SurveyQuestion } from '@surveydesk/shared'

const QUESTIONS: SurveyQuestion[] = [
  { id: 'r', type: 'rating', label: '만족도', required: true },
  {
    id: 'c',
    type: 'single_choice',
    label: '용도',
    required: false,
    options: [
      { value: 'a', label: '개인' },
      { value: 'b', label: '팀, 회사' },
    ],
  },
  { id: 't', type: 'text', label: '한마디', required: false },
]

function resp(partial: Partial<ResponseDto>): ResponseDto {
  return {
    id: 'id',
    appId: 'demo',
    surveyVersion: 2,
    answers: {},
    respondentUserId: null,
    respondentEmail: null,
    meta: null,
    createdAt: '2026-06-10T00:00:00.000Z',
    ...partial,
  }
}

describe('csvCell', () => {
  it('콤마·따옴표·개행이 있으면 감싸고 따옴표를 이스케이프한다', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('수식 인젝션 위험 문자는 작은따옴표로 무력화한다', () => {
    // 선행 부호는 작은따옴표로 무력화. 특수문자(콤마 등)가 없으면 감싸지 않는다.
    expect(csvCell('=SUM(A1)')).toBe(`'=SUM(A1)`)
    expect(csvCell('+1')).toBe(`'+1`)
    expect(csvCell('@cmd')).toBe(`'@cmd`)
    // 무력화 + 내부 콤마가 있으면 둘 다 적용된다.
    expect(csvCell('=A1,B2')).toBe(`"'=A1,B2"`)
  })
})

describe('respondentLabel', () => {
  it('이메일 > uid > 익명 우선순위', () => {
    expect(respondentLabel({ respondentEmail: 'a@b.com', respondentUserId: 'u1' })).toBe('a@b.com')
    expect(respondentLabel({ respondentEmail: null, respondentUserId: 'u1' })).toBe('uid:u1')
    expect(respondentLabel({ respondentEmail: null, respondentUserId: null })).toBe('익명')
  })
})

describe('responsesToCsv', () => {
  it('헤더는 메타 열 + 질문 라벨, 행은 사람이 읽는 답', () => {
    const csv = responsesToCsv(QUESTIONS, [
      resp({ answers: { r: 5, c: 'a', t: '좋아요' }, respondentEmail: 'x@y.com' }),
    ])
    const [header, row] = csv.split('\r\n')
    expect(header).toBe('시각,버전,응답자,만족도,용도,한마디')
    expect(row).toContain('v2')
    expect(row).toContain('x@y.com')
    expect(row).toContain('★★★★★ (5)')
    expect(row).toContain('개인')
    expect(row).toContain('좋아요')
  })

  it('옵션 라벨에 콤마가 있어도 한 열을 유지한다(CSV 안전)', () => {
    const csv = responsesToCsv(QUESTIONS, [resp({ answers: { c: 'b' } })])
    const row = csv.split('\r\n')[1]!
    expect(row).toContain('"팀, 회사"')
    // 메타 3열 + 질문 3열 = 6열(콤마 5개), 따옴표 안의 콤마는 세지 않음
    const topLevelCommas = row.replace(/"[^"]*"/g, '').split(',').length - 1
    expect(topLevelCommas).toBe(5)
  })

  it('미응답 셀은 빈 값으로 남긴다', () => {
    const csv = responsesToCsv(QUESTIONS, [resp({ answers: { r: 4 } })])
    const row = csv.split('\r\n')[1]!
    expect(row.endsWith(',,')).toBe(true) // 용도·한마디 미응답
  })
})

describe('csvFilename', () => {
  it('appId 와 날짜로 안정적인 이름을 만든다', () => {
    expect(csvFilename('offhours', new Date('2026-06-09T12:00:00Z'))).toMatch(
      /^surveydesk-offhours-responses-202606\d\d\.csv$/
    )
  })
})
