import { isSecretKey } from '@desk/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { InMemoryTenantStore } from './memory-stores'
import { TenantError, TenantService } from './tenant-service'

describe('TenantService', () => {
  let service: TenantService
  let store: InMemoryTenantStore

  beforeEach(() => {
    store = new InMemoryTenantStore()
    service = new TenantService(store, 'test-pepper')
  })

  it('가입: publishable 평문 + secret 평문(1회) 반환, 기본 free', async () => {
    const t = await service.signup({ name: 'Acme Inc.' })
    expect(t.slug).toBe('acme-inc')
    expect(t.plan).toBe('free')
    expect(t.publishableKey.startsWith('pk_')).toBe(true)
    expect(isSecretKey(t.secretKey)).toBe(true)
    // DTO 에 해시가 새지 않는다
    expect(JSON.stringify(t)).not.toContain('secretKeyHash')
  })

  it('가입: slug 충돌 시 접미사로 회피', async () => {
    const a = await service.signup({ name: 'Acme' })
    const b = await service.signup({ name: 'Acme' })
    expect(a.slug).toBe('acme')
    expect(b.slug).toBe('acme-2')
  })

  it('가입: plan 과 corsOrigins 지정', async () => {
    const t = await service.signup({
      name: 'Pro Co',
      plan: 'pro',
      corsOrigins: ['https://pro.example'],
    })
    expect(t.plan).toBe('pro')
    expect(t.corsOrigins).toEqual(['https://pro.example'])
  })

  it('secret 키 인증: 올바른 키만 통과', async () => {
    const t = await service.signup({ name: 'Acme' })
    const auth = await service.authenticateBySecretKey(t.secretKey)
    expect(auth?.id).toBe(t.id)
    expect(await service.authenticateBySecretKey('sk_wrong')).toBeNull()
  })

  it('secret 키 인증: 잘못된 pepper 의 서비스로는 통과 못 함', async () => {
    const t = await service.signup({ name: 'Acme' })
    const other = new TenantService(store, 'different-pepper')
    expect(await other.authenticateBySecretKey(t.secretKey)).toBeNull()
  })

  it('키 회전: 이전 secret 무효 + 새 키 발급', async () => {
    const t = await service.signup({ name: 'Acme' })
    const oldKey = t.secretKey
    const oldPk = t.publishableKey

    const rotated = await service.rotateKeys(t.id)
    expect(rotated.secretKey).not.toBe(oldKey)
    expect(rotated.publishableKey).not.toBe(oldPk)

    // 이전 키는 더 이상 인증 불가, 새 키는 통과
    expect(await service.authenticateBySecretKey(oldKey)).toBeNull()
    expect((await service.authenticateBySecretKey(rotated.secretKey))?.id).toBe(t.id)
  })

  it('수정: name·corsOrigins 갱신', async () => {
    const t = await service.signup({ name: 'Acme' })
    const updated = await service.update(t.id, {
      name: 'Acme 2',
      corsOrigins: ['https://a.example', 'https://b.example'],
    })
    expect(updated.name).toBe('Acme 2')
    expect(updated.corsOrigins).toHaveLength(2)
  })

  it('플랜 변경', async () => {
    const t = await service.signup({ name: 'Acme' })
    const up = await service.setPlan(t.id, 'scale')
    expect(up.plan).toBe('scale')
  })

  it('없는 테넌트 조회/회전은 TenantError(not_found)', async () => {
    await expect(service.getById('nope')).rejects.toBeInstanceOf(TenantError)
    await expect(service.rotateKeys('nope')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('publishable 키로 조회', async () => {
    const t = await service.signup({ name: 'Acme' })
    const found = await service.findByPublishableKey(t.publishableKey)
    expect(found?.id).toBe(t.id)
    expect(await service.findByPublishableKey('pk_nope')).toBeNull()
  })
})
