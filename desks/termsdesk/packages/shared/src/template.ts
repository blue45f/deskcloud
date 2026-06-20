/**
 * 동적 약관 템플릿 — `{{ key }}` 자리표시자를 URL 파라미터 등으로 치환합니다.
 *
 * 치환은 게시본 *원문*을 바꾸지 않습니다(content_hash 는 원문에 동결). 표시 시점에만
 * 적용되는 렌더 레이어이므로, 동의 증거는 항상 원문 해시에 귀속됩니다.
 */

/** `{{ company_name }}`, `{{plan}}` 등. 키는 영숫자·`_`·`-`·`.` 허용. */
const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g

/**
 * 본문의 `{{ key }}` 를 vars[key] 로 치환. 값이 없는(undefined/'') 키는 **그대로 남깁니다**
 * — 빈 문자열로 지워 문맥이 깨지는 것을 막기 위함입니다.
 */
export function applyTemplateVars(body: string, vars: Record<string, string | undefined>): string {
  return body.replace(VAR_RE, (full, key: string) => {
    const v = vars[key]
    return v == null || v === '' ? full : v
  })
}

/** 본문에 등장하는 모든 템플릿 변수 키(중복 제거, 등장 순서). */
export function extractTemplateVars(body: string): string[] {
  const seen = new Set<string>()
  for (const m of body.matchAll(VAR_RE)) {
    const key = m[1]
    if (key) seen.add(key)
  }
  return [...seen]
}

/** 치환 후에도 남아있는(값이 안 주어진) 변수 키. 호출측에서 누락 변수 경고에 사용. */
export function unresolvedTemplateVars(
  body: string,
  vars: Record<string, string | undefined>
): string[] {
  return extractTemplateVars(body).filter((k) => {
    const v = vars[k]
    return v == null || v === ''
  })
}
