import { describe, expect, it } from 'vitest'

import { isTransientPostgresError } from './database.service'

describe('isTransientPostgresError', () => {
  it('중첩된 네트워크성 postgres 오류를 transient 로 분류한다', () => {
    const error = new Error('Failed query', {
      cause: new AggregateError([{ code: 'ETIMEDOUT' }, new Error('socket ECONNRESET')]),
    })

    expect(isTransientPostgresError(error)).toBe(true)
  })

  it('일반 쿼리 오류는 transient 로 분류하지 않는다', () => {
    const error = new Error('relation "missing_table" does not exist')

    expect(isTransientPostgresError(error)).toBe(false)
  })
})
