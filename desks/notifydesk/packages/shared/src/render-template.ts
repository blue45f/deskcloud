import { TEMPLATE_VAR_RE } from './constants'

/** 템플릿 렌더 입력 — 변수명 → 값. 점 표기(`user.name`)는 중첩 객체 조회. */
export type TemplateData = Record<string, unknown>

/** 점 표기 경로로 중첩 값을 안전하게 조회한다(없으면 undefined). */
function lookup(data: TemplateData, path: string): unknown {
  if (path in data) return data[path]
  // 점 표기 중첩 조회: "user.name" → data.user.name
  let cur: unknown = data
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** 값을 문자열로 안전 변환(null/undefined → 빈 문자열). */
function stringify(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return ''
  }
}

/**
 * mustache-ish 템플릿 렌더 — `{{ var }}` 토큰을 data 의 값으로 치환한다.
 * - 점 표기 중첩 조회(`{{ user.name }}`)
 * - 매칭되지 않는 변수는 빈 문자열로(엄격 모드 아님 — 알림은 누락 변수에 관대)
 * - 순수 함수 — api(발송 직전 렌더)·web(미리보기)·테스트 공유.
 *
 * 의도적으로 작게 유지: 조건/반복/이스케이프 없음. 알림 제목·본문 치환만 담당.
 */
export function renderTemplate(template: string, data: TemplateData = {}): string {
  return template.replace(TEMPLATE_VAR_RE, (_match, rawName: string) =>
    stringify(lookup(data, rawName.trim()))
  )
}

/** 템플릿에 등장하는 변수명 목록(중복 제거, 등장 순서 유지) — 미리보기/검증용. */
export function extractTemplateVars(template: string): string[] {
  const seen = new Set<string>()
  for (const m of template.matchAll(TEMPLATE_VAR_RE)) {
    const name = m[1]?.trim()
    if (name) seen.add(name)
  }
  return [...seen]
}
