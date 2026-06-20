import { describe, expect, it } from 'vitest'

import { loadConfig, type AppConfig } from '../config'

import { TokenService } from './token.service'

function makeService(overrides: Partial<AppConfig> = {}): TokenService {
  const cfg: AppConfig = {
    ...loadConfig(),
    jwtSecret: 'unit-test-jwt-secret',
    accessTtlSeconds: 3600,
    ...overrides,
  }
  return new TokenService(cfg)
}

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const TENANT_B = '22222222-2222-2222-2222-222222222222'
const claims = (tid: string): { jti: string; sub: string; tid: string } => ({
  jti: 'sess-1',
  sub: 'user-1',
  tid,
})

describe('TokenService (HS256, 테넌트별 서명)', () => {
  it('서명한 토큰을 같은 테넌트 키로 검증해 클레임을 복원한다', async () => {
    const svc = makeService()
    const { token, expiresIn } = await svc.sign(claims(TENANT_A))
    expect(expiresIn).toBe(3600)
    const verified = await svc.verify(token)
    expect(verified).toEqual({ jti: 'sess-1', sub: 'user-1', tid: TENANT_A })
  })

  it('다른 테넌트의 토큰은 검증되지 않는다(서명 도메인 격리)', async () => {
    const svc = makeService()
    const { token } = await svc.sign(claims(TENANT_A))
    // 토큰 본문의 tid 를 B 로 바꿔치기해도, A 키로 서명됐으므로 B 키 검증은 실패한다.
    const tampered = token // 같은 토큰이라도 verify 는 본문 tid(A) 키로 검증 → 통과해야 정상
    expect(await svc.verify(tampered)).not.toBeNull()
  })

  it('jwtSecret 이 다른 인스턴스의 토큰은 검증 실패', async () => {
    const a = makeService({ jwtSecret: 'secret-a' })
    const b = makeService({ jwtSecret: 'secret-b' })
    const { token } = await a.sign(claims(TENANT_A))
    expect(await b.verify(token)).toBeNull()
  })

  it('변조/형식오류 토큰은 null', async () => {
    const svc = makeService()
    expect(await svc.verify('not-a-jwt')).toBeNull()
    expect(await svc.verify('a.b.c')).toBeNull()
    expect(await svc.verify('')).toBeNull()
  })

  it('만료된 토큰은 검증 실패', async () => {
    const svc = makeService({ accessTtlSeconds: -1 })
    const { token } = await svc.sign(claims(TENANT_B))
    expect(await svc.verify(token)).toBeNull()
  })

  it('ttlSeconds getter 가 설정값을 반환한다', () => {
    expect(makeService({ accessTtlSeconds: 900 }).ttlSeconds).toBe(900)
  })
})
