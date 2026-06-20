/**
 * DB 드라이버 에러 → 도메인 의미 매핑 헬퍼.
 *
 * check-then-insert 패턴은 사전 SELECT 가 동시성에서 경합에 진다(두 요청이 함께 통과 후 INSERT).
 * 유니크 제약이 무결성을 지키지만, 두 번째 INSERT 는 Postgres unique_violation(SQLSTATE 23505)을
 * 던져 AllExceptionsFilter 가 일반 500 으로 떨어뜨린다. 이를 잡아 도메인 ConflictException 으로
 * 다시 던지면 API 계약(409)을 동시성에서도 보존한다. node-postgres·PGlite 모두 `code: '23505'`.
 */

/** Postgres unique_violation SQLSTATE. */
export const PG_UNIQUE_VIOLATION = '23505'

/**
 * 드라이버 에러가 unique_violation(23505)인지 — pg·PGlite 양쪽의 `code` 를 본다.
 *
 * drizzle-orm 은 드라이버 에러를 `DrizzleQueryError` 로 감싸며 원본 드라이버 에러를 `cause` 에
 * 둔다(이 경우 `code` 는 wrapper 가 아니라 cause 에 있다). 그래서 top-level 뿐 아니라 `cause`
 * 체인을 따라가며 `23505` 를 찾는다 — 그렇지 않으면 동시성 경합이 409 대신 500 으로 샌다.
 */
export function isUniqueViolation(err: unknown): boolean {
  let cur: unknown = err
  // cause 체인은 짧지만(보통 1단계), 무한 루프 방지를 위해 상한을 둔다.
  for (let depth = 0; depth < 5 && typeof cur === 'object' && cur !== null; depth += 1) {
    if ((cur as { code?: unknown }).code === PG_UNIQUE_VIOLATION) return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}
