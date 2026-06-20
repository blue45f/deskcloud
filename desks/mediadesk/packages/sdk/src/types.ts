/**
 * 공개(publishable) API 계약 타입 — SDK가 의존성 없이 단독으로 쓰도록 여기에 정의한다.
 * 백엔드 @mediadesk/shared 의 DTO와 형태가 일치하며(키/url/메타), shared 가 완성되면
 * 그쪽을 단일 소스로 좁혀도 이 표면(surface)은 그대로 유지된다.
 */

/** 변환 출력 포맷 — buildUrl/?format= 으로 지정. */
export type TransformFormat = 'jpeg' | 'png' | 'webp' | 'avif'

/** 공개 자산 표현(업로드 결과·갤러리 항목). 서버 직렬화 결과. */
export interface MediaAsset {
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
  /** 래스터 이미지로 온더플라이 변환 가능 여부(서버가 sharp 로 처리 가능한지). */
  transformable: boolean
  /** 픽셀 크기(이미지일 때, 알 수 있으면). */
  width?: number | null
  height?: number | null
  /** ISO 생성 시각. */
  createdAt: string
}

/** upload() 결과 — 자산 메타 + 편의 url. */
export type UploadResult = MediaAsset

/** 공개 자산 목록(폴더 필터·페이지네이션). */
export interface AssetListResult {
  items: MediaAsset[]
  /** 같은 필터의 전체 건수. */
  total: number
  offset: number
  limit: number
}

/** 변환 옵션 — buildUrl 및 갤러리 썸네일에 사용. */
export interface TransformOptions {
  /** 목표 너비(px). */
  w?: number
  /** 목표 높이(px). */
  h?: number
  /** 출력 포맷(미지정 시 원본 유지). */
  format?: TransformFormat
  /** 품질 1–100(손실 포맷에만 적용). */
  q?: number
}

/** upload 옵션. */
export interface UploadOptions {
  /** 논리 폴더(키 접두 세그먼트). 예: 'avatars'. 비우면 루트. */
  folder?: string
  /** 진행률 콜백(0–1). XHR 기반이라 정확한 업로드 진행을 보고한다. */
  onProgress?: (fraction: number) => void
  /** 업로드 취소 신호. */
  signal?: AbortSignal
  /** 저장 시 사용할 파일명(미지정 시 file.name). */
  filename?: string
}
