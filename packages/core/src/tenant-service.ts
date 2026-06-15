import {
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  isValidSlug,
  slugify,
  verifySecretKey,
  type CreateTenantInput,
  type Plan,
  type TenantDto,
  type TenantWithSecretDto,
  type UpdateTenantInput,
} from '@desk/shared'

import type { TenantRecord, TenantStore } from './ports'

/** core 의 도메인 에러 — 어댑터(NestJS)가 HTTP 상태로 매핑한다(프레임워크 무관 유지). */
export class TenantError extends Error {
  constructor(
    message: string,
    readonly code: 'slug_taken' | 'not_found' | 'invalid'
  ) {
    super(message)
    this.name = 'TenantError'
  }
}

/** 내부 레코드를 공개 DTO 로 직렬화(secretKeyHash 절대 노출 안 함). */
export function toTenantDto(rec: TenantRecord): TenantDto {
  return {
    id: rec.id,
    name: rec.name,
    slug: rec.slug,
    publishableKey: rec.publishableKey,
    corsOrigins: rec.corsOrigins,
    plan: rec.plan,
    createdAt: rec.createdAt.toISOString(),
    updatedAt: rec.updatedAt.toISOString(),
  }
}

/**
 * 테넌트 서비스 — 가입·조회·수정·키 회전·인증을 담당(프레임워크 무관).
 * 키 생성/해시는 @desk/shared 유틸을 쓰고, 영속화는 TenantStore 포트에 위임.
 */
export class TenantService {
  constructor(
    private readonly store: TenantStore,
    /** secret 키 해시 페퍼(서버 비밀). */
    private readonly pepper = ''
  ) {}

  /**
   * 가입 — 새 테넌트 + publishable/secret 키 발급. secret 평문은 **응답에서 1회만** 반환.
   * slug 미지정 시 name 에서 파생, 충돌 시 짧은 접미사로 회피.
   */
  async signup(input: CreateTenantInput): Promise<TenantWithSecretDto> {
    const slug = await this.resolveSlug(input.slug ?? slugify(input.name))

    const secretKey = generateSecretKey()
    const rec = await this.store.insert({
      name: input.name,
      slug,
      publishableKey: generatePublishableKey(),
      secretKeyHash: hashSecretKey(secretKey, this.pepper),
      corsOrigins: input.corsOrigins ?? [],
      plan: input.plan ?? 'free',
    })

    return { ...toTenantDto(rec), secretKey }
  }

  /** id 로 조회(없으면 TenantError). */
  async getById(id: string): Promise<TenantRecord> {
    const rec = await this.store.findById(id)
    if (!rec) throw new TenantError('테넌트를 찾을 수 없습니다', 'not_found')
    return rec
  }

  /**
   * secret 키로 테넌트 인증 — 해시 매칭. 평문 키를 받아 페퍼와 함께 해시 후 조회·재검증.
   * (DB 조회를 해시로 1차 좁히고, timing-safe verify 로 2차 확인.)
   */
  async authenticateBySecretKey(secretKey: string): Promise<TenantRecord | null> {
    const hash = hashSecretKey(secretKey, this.pepper)
    const rec = await this.store.findBySecretKeyHash(hash)
    if (!rec) return null
    return verifySecretKey(secretKey, rec.secretKeyHash, this.pepper) ? rec : null
  }

  /** publishable 키로 테넌트 조회(공개 경로 — CORS allowlist 검사에 사용). */
  async findByPublishableKey(key: string): Promise<TenantRecord | null> {
    return this.store.findByPublishableKey(key)
  }

  /** 테넌트 수정(name·corsOrigins). */
  async update(id: string, input: UpdateTenantInput): Promise<TenantRecord> {
    await this.getById(id) // 존재 확인
    const patch: Partial<Pick<TenantRecord, 'name' | 'corsOrigins'>> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.corsOrigins !== undefined) patch.corsOrigins = input.corsOrigins
    const updated = await this.store.update(id, patch)
    if (!updated) throw new TenantError('테넌트를 찾을 수 없습니다', 'not_found')
    return updated
  }

  /** 플랜 변경(빌링 경로에서 호출). */
  async setPlan(id: string, plan: Plan): Promise<TenantRecord> {
    await this.getById(id)
    const updated = await this.store.update(id, { plan })
    if (!updated) throw new TenantError('테넌트를 찾을 수 없습니다', 'not_found')
    return updated
  }

  /**
   * 키 회전 — 새 secret 키 발급 + 해시 교체(이전 키 즉시 무효). publishable 키도 함께 갱신.
   * 새 secret 평문은 **이 응답에서 1회만** 반환.
   */
  async rotateKeys(id: string): Promise<TenantWithSecretDto> {
    await this.getById(id)
    const secretKey = generateSecretKey()
    const updated = await this.store.update(id, {
      publishableKey: generatePublishableKey(),
      secretKeyHash: hashSecretKey(secretKey, this.pepper),
    })
    if (!updated) throw new TenantError('테넌트를 찾을 수 없습니다', 'not_found')
    return { ...toTenantDto(updated), secretKey }
  }

  /** slug 검증 + 충돌 회피(이미 있으면 -2, -3 … 접미사). */
  private async resolveSlug(candidate: string): Promise<string> {
    let base = slugify(candidate)
    if (!isValidSlug(base)) base = 'tenant'
    if (!(await this.store.findBySlug(base))) return base
    for (let i = 2; i < 1000; i += 1) {
      const next = `${base}-${i}`.slice(0, 64)
      if (!(await this.store.findBySlug(next))) return next
    }
    throw new TenantError('slug 충돌을 해소할 수 없습니다', 'slug_taken')
  }
}
