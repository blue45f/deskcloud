import { SLUG_RE } from './constants'

/**
 * 임의 이름을 slug 후보로 정규화한다(소문자·숫자·하이픈). 빈 결과면 'tenant'.
 * - 공백/언더스코어 → 하이픈, 비허용 문자 제거, 연속 하이픈 축약, 양끝 하이픈 제거.
 */
export function slugify(input: string): string {
  const s = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return s.length > 0 ? s : 'tenant'
}

/** slug 형식 검사(소문자·숫자·하이픈, 1~64자). */
export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 64 && SLUG_RE.test(slug)
}
