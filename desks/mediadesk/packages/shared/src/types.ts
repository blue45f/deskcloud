/**
 * 도메인 DTO 타입 — 서버 직렬화 결과(api → web). SDK 의 타입과 형태가 일치하며
 * (key/url/contentType/size/folder/transformable/…), 여기서는 어드민·테넌트 표면까지 포함한다.
 */
import type { Plan } from './constants'

/** 공개 자산 표현(업로드 결과·갤러리 항목). */
export interface AssetDto {
  /** 테넌트 내부 상대 키. 예: 'avatars/ab12-photo.png'. */
  key: string
  /** 즉시 사용 가능한 공개 URL(원본). */
  url: string
  /** MIME 타입. 예: 'image/png'. */
  contentType: string
  /** 바이트 크기. */
  size: number
  /** 논리 폴더(루트면 null). */
  folder: string | null
  /** 래스터 이미지로 온더플라이 변환 가능 여부. */
  transformable: boolean
  /** 픽셀 크기(이미지일 때, 알 수 있으면). */
  width?: number | null
  height?: number | null
  /** ISO 생성 시각. */
  createdAt: string
}

/** 업로드 결과 — 자산 메타 + 편의 url. */
export type UploadResultDto = AssetDto

/** 공개/어드민 자산 목록(폴더 필터·페이지네이션). */
export interface AssetListDto {
  items: AssetDto[]
  /** 같은 필터의 전체 건수. */
  total: number
  offset: number
  limit: number
}

/** 테넌트 사용량(바이트·건수). */
export interface UsageDto {
  bytes: number
  count: number
  /** free 플랜 소프트 캡(plan='pro' 면 null). */
  maxBytes: number | null
  maxCount: number | null
}

/** 어드민이 보는 테넌트(secret 키는 절대 포함하지 않음 — 해시만 저장). */
export interface TenantDto {
  id: string
  slug: string
  name: string
  plan: Plan
  /** 공개 엔드포인트 CORS 허용 origin 목록('*' = 전체 허용). */
  corsOrigins: string[]
  /** 노출 가능한 publishable 키(pk_…). */
  publishableKey: string
  /** 활성 스토리지 드라이버('local' | 's3'). */
  storageDriver: string
  usage: UsageDto
  createdAt: string
}

/**
 * 가입(signup) 응답 — 이때만 secret 키(sk_) 평문을 1회 노출한다(이후 저장 안 됨, 재발급만 가능).
 */
export interface SignupResultDto {
  tenant: TenantDto
  /** 평문 secret 키 — 이 응답에서만 노출. 안전한 곳에 보관하세요. */
  secretKey: string
}

/** 키 회전(rotate) 응답 — 새 키 평문 1회 노출. */
export interface RotateKeysResultDto {
  publishableKey: string
  secretKey: string
}

/**
 * 운영 지표(operator overview) — 마스터 토큰 전용. 정직성 우선:
 *   - 가입(signups)은 tenants 테이블의 실제 집계.
 *   - 방문/트래픽(visitors/traffic)은 롤아웃 시점부터 누적하는 신규 카운터다(소급 백필 없음).
 *     `trafficSince` 가 집계 시작일(가장 오래된 일별 버킷, 없으면 null).
 */
export interface OverviewDto {
  /** 전체 테넌트 수(실데이터). */
  totalSignups: number
  /** 오늘(서버 TZ) 신규 가입 테넌트 수(실데이터). */
  todaySignups: number
  /** 집계 시작 이후 누적 방문(hits) 합계(신규 추적). */
  totalTraffic: number
  /** 오늘 고유 방문자 수(advisory · 신규 추적). */
  todayVisitors: number
  /** 오늘 누적 방문(hits) — todayVisitors 보다 큼(같은 방문자가 여러 번). */
  todayHits: number
  /** 방문 집계가 시작된 날(ISO date, YYYY-MM-DD). 데이터가 없으면 null. */
  trafficSince: string | null
}

/** 스토리지 어댑터 정보(어드민 정보 패널). */
export interface StorageInfoDto {
  driver: string
  /** 사람이 읽는 위치 설명(local: 디렉터리, s3: 버킷/리전). */
  location: string
  /** sharp(이미지 변환) 사용 가능 여부 — best-effort 로딩 결과. */
  transformAvailable: boolean
}
