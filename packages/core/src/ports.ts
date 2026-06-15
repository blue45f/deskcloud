import type { MemberRole, Plan, UsageMetric } from '@desk/shared'

/**
 * 저장소 포트(ports) — core 는 DB 를 모른다. apps/api 가 Drizzle 로 이 인터페이스를 구현해
 * 주입한다(헥사고날). 테스트는 인메모리 구현을 넣는다.
 */

/** 영속 테넌트 레코드(내부) — secretKeyHash 포함(서비스 경계 안에서만 다룬다). */
export interface TenantRecord {
  id: string
  name: string
  slug: string
  publishableKey: string
  /** SHA-256(secretKey + pepper). 평문은 저장하지 않는다. */
  secretKeyHash: string
  corsOrigins: string[]
  plan: Plan
  createdAt: Date
  updatedAt: Date
}

/** 멤버(좌석) 레코드. */
export interface MemberRecord {
  id: string
  tenantId: string
  email: string
  role: MemberRole
  createdAt: Date
}

/** 새 테넌트 영속화 입력(키는 이미 생성·해시된 상태로 전달). */
export interface CreateTenantRecord {
  name: string
  slug: string
  publishableKey: string
  secretKeyHash: string
  corsOrigins: string[]
  plan: Plan
}

/** 테넌트 저장소 포트. */
export interface TenantStore {
  insert(rec: CreateTenantRecord): Promise<TenantRecord>
  findById(id: string): Promise<TenantRecord | null>
  findBySlug(slug: string): Promise<TenantRecord | null>
  findByPublishableKey(key: string): Promise<TenantRecord | null>
  /** secret 키 해시로 조회(인증 경로) — 평문은 호출자가 해시해서 넘긴다. */
  findBySecretKeyHash(hash: string): Promise<TenantRecord | null>
  update(
    id: string,
    patch: Partial<Pick<TenantRecord, 'name' | 'corsOrigins' | 'plan' | 'secretKeyHash' | 'publishableKey'>>
  ): Promise<TenantRecord | null>
}

/** 멤버(좌석) 저장소 포트. */
export interface MemberStore {
  insert(rec: Omit<MemberRecord, 'id' | 'createdAt'>): Promise<MemberRecord>
  listByTenant(tenantId: string): Promise<MemberRecord[]>
  countByTenant(tenantId: string): Promise<number>
  findByEmail(tenantId: string, email: string): Promise<MemberRecord | null>
  remove(tenantId: string, id: string): Promise<boolean>
}

/** 사용량 저장소 포트 — (tenantId, period, metric) 별 카운터의 원자적 증가/조회. */
export interface UsageStore {
  /** 카운터를 n 만큼 증가시키고 누적값을 반환(upsert). */
  increment(tenantId: string, period: string, metric: UsageMetric, n: number): Promise<number>
  /** 단일 메트릭의 현재값(없으면 0). */
  get(tenantId: string, period: string, metric: UsageMetric): Promise<number>
  /** 기간 내 모든 메트릭의 맵. */
  getAll(tenantId: string, period: string): Promise<Partial<Record<UsageMetric, number>>>
  /** 기간 내 메트릭(들) 리셋. metric 미지정 시 기간 전체 리셋. */
  reset(tenantId: string, period: string, metric?: UsageMetric): Promise<void>
}
