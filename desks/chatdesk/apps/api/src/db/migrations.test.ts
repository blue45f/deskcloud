import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

import { MIGRATIONS } from './migrations'

/**
 * 부팅 마이그레이션은 멱등이어야 한다(IF NOT EXISTS 등). 부팅 마이그레이터가 _migrations
 * 추적을 잃거나 두 번 적용해도 안전한지, PGlite(=pg 의미론)에서 두 번 실행해 검증한다.
 */
describe('MIGRATIONS (PGlite, idempotent)', () => {
  it('두 번 적용해도 오류 없이 통과(멱등)하고 신규 테이블이 존재한다', async () => {
    const client = await PGlite.create()
    for (const m of MIGRATIONS) await client.exec(m.sql)
    // 두 번째 적용 — IF NOT EXISTS 덕에 throw 없이 통과해야 한다.
    for (const m of MIGRATIONS) await client.exec(m.sql)

    // 0001 의 트래픽 테이블이 생성됐는지 확인(쿼리 가능 = 존재).
    const visits = (await client.query('SELECT count(*)::int AS c FROM tenant_visits')) as {
      rows: { c: number }[]
    }
    expect(visits.rows[0]!.c).toBe(0)
    const uniques = (await client.query('SELECT count(*)::int AS c FROM tenant_visit_uniques')) as {
      rows: { c: number }[]
    }
    expect(uniques.rows[0]!.c).toBe(0)
  })

  it('마이그레이션 이름은 유일하다(중복 append 방지)', () => {
    const names = MIGRATIONS.map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
