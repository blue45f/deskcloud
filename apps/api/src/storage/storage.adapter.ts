/**
 * 스토리지 어댑터 계약 — 자산 바이트의 저장/조회/삭제를 추상화한다.
 * 'local'(파일시스템)·'s3'(스텁) 구현이 이 인터페이스를 만족한다.
 *
 * 키는 테넌트별 격리된 상대 경로다(예: '<tenantSlug>/avatars/ab12-x.png').
 * 어댑터는 키 안전성(경로 순회 차단)을 자체 보장하지 않으므로, 호출부(AssetsService)에서
 * @mediadesk/shared 의 isSafeKey 로 검증한 키만 넘긴다.
 */
export interface StoredObject {
  /** 원본 바이트. */
  body: Buffer
  /** MIME(저장 시 기록). */
  contentType: string
  /** 바이트 크기. */
  size: number
}

export interface StorageAdapter {
  /** 활성 드라이버 이름('local' | 's3'). */
  readonly driver: string
  /** 사람이 읽는 위치 설명(어드민 정보 패널). */
  describe(): string

  /** 바이트 저장(덮어쓰기). 키는 테넌트 격리 상대 경로. */
  put(key: string, body: Buffer, contentType: string): Promise<void>
  /** 바이트 조회. 없으면 null. */
  get(key: string): Promise<StoredObject | null>
  /** 존재 여부. */
  exists(key: string): Promise<boolean>
  /** 삭제(없어도 에러 없이 통과 — 멱등). */
  delete(key: string): Promise<void>
  /** 테넌트 전체(접두 디렉터리) 삭제 — 테넌트 정리용. */
  deletePrefix(prefix: string): Promise<void>
}
