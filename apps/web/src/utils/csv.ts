import type { ResponseDto, SurveyQuestion } from '@surveydesk/shared'

import { formatAnswer } from '@/components/feature/AnswerCells'
import { formatDateTime } from '@/utils/format'

/**
 * 응답을 CSV 로 직렬화하기 위한 순수 유틸. 한 행 = 한 응답, 고정 메타 열(시각·버전·응답자)
 * 뒤에 질문 정의 순서대로 질문별 답 열이 붙는다. choice/rating 등은 사람이 읽는 텍스트
 * (`formatAnswer`)로 풀어 쓴다 — 운영자가 바로 시트로 분석할 수 있도록.
 *
 * 의존성 0(브라우저 Blob 다운로드만). 서버 변경 없이 클라이언트에서 전 페이지를 모아 만든다.
 */

/** RFC 4180 — 따옴표·콤마·개행·선행 부호(=,+,-,@: 수식 인젝션)를 안전하게 감싼다. */
export function csvCell(value: string): string {
  // CSV 인젝션 방어: 스프레드시트가 수식으로 해석할 수 있는 선행 문자는 작은따옴표로 무력화.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`
  }
  return guarded
}

/** 응답자 표시값 — 이메일 > uid > 익명. */
export function respondentLabel(
  r: Pick<ResponseDto, 'respondentEmail' | 'respondentUserId'>
): string {
  if (r.respondentEmail) return r.respondentEmail
  if (r.respondentUserId) return `uid:${r.respondentUserId}`
  return '익명'
}

/** 응답 목록 → CSV 문자열(헤더 1행 + 응답 N행). 질문 열은 정의 순서. */
export function responsesToCsv(questions: SurveyQuestion[], responses: ResponseDto[]): string {
  const header = ['시각', '버전', '응답자', ...questions.map((q) => q.label)]
  const rows = responses.map((r) => [
    formatDateTime(r.createdAt),
    `v${r.surveyVersion}`,
    respondentLabel(r),
    ...questions.map((q) => {
      const raw = r.answers[q.id]
      return raw == null || raw === '' ? '' : formatAnswer(q, raw)
    }),
  ])
  return [header, ...rows]
    .map((cells) => cells.map((c) => csvCell(String(c))).join(','))
    .join('\r\n')
}

/** appId·날짜로 안정적인 파일명을 만든다. */
export function csvFilename(appId: string, now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  return `surveydesk-${appId}-responses-${stamp}.csv`
}

/** CSV 문자열을 브라우저 다운로드로 떨군다(BOM 포함 — Excel 한글 깨짐 방지). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 다음 틱에 해제 — 일부 브라우저에서 즉시 revoke 시 다운로드가 취소될 수 있다.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
