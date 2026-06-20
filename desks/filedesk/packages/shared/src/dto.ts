import type { Plan, StorageDriver, UsageMetric, Visibility } from './constants'

/**
 * 가입 직후에만 반환되는 테넌트 표현 — secretKey 평문은 이때 한 번만 노출된다.
 * (이후 어떤 API 도 secretKey 평문을 돌려주지 않는다. 해시만 저장.)
 */
export interface TenantCredentialsDto {
  id: string
  name: string
  slug: string
  plan: Plan
  publishableKey: string
  /** 평문 secret 키 — 가입/rotate 응답에서만 1회 노출. 저장은 해시. */
  secretKey: string
  corsOrigins: string[]
  createdAt: string
}

/** 일반 테넌트 표현(secret 평문 제외) — 어드민 조회·갱신 응답. */
export interface TenantDto {
  id: string
  name: string
  slug: string
  plan: Plan
  publishableKey: string
  corsOrigins: string[]
  /** 누적 업로드(생성된 파일 수) 카운터. */
  usageCount: number
  createdAt: string
}

/** 파일 객체 메타데이터. 바이트는 포함하지 않는다(서빙은 별도 엔드포인트). */
export interface FileObjectDto {
  id: string
  tenantId: string
  /** 불투명 key — 서빙 URL 의 경로 (`/api/files/:key`). */
  key: string
  filename: string
  contentType: string
  sizeBytes: number
  visibility: Visibility
  storageDriver: StorageDriver
  createdAt: string
}

/** 업로드 결과 — 위젯/SDK 가 받는 최소 형태. */
export interface UploadResultDto {
  id: string
  key: string
  /** 서빙 URL(절대 또는 상대). public 은 그대로, private 은 토큰 필요. */
  url: string
  filename: string
  contentType: string
  sizeBytes: number
  visibility: Visibility
}

/** 파일 목록(어드민, 페이지네이션). */
export interface FileListDto {
  items: FileObjectDto[]
  total: number
  offset: number
  limit: number
}

/** 파일 통계(어드민) — 개수·총 바이트(+ 가시성 분해). */
export interface FileStatsDto {
  /** 메트릭별 합계 — { files, storage_bytes }. */
  metrics: Record<UsageMetric, number>
  byVisibility: {
    visibility: Visibility
    files: number
    storageBytes: number
  }[]
}

/** 서명 URL 발급 결과(private 파일 한시 접근). */
export interface SignedUrlDto {
  url: string
  token: string
  expiresAt: string
}

/** 삭제 결과. */
export interface DeleteResultDto {
  deleted: boolean
  id: string
}
