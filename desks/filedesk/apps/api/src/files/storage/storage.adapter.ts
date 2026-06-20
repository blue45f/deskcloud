/**
 * 스토리지 어댑터 — 파일 바이트의 영속화/조회/삭제를 추상화한다.
 *
 * 레지스트리(메타데이터)는 항상 Postgres `file_objects` 테이블이고, 실제 바이트만 드라이버가
 * 담당한다. v1 기본은 `postgres`(bytea 인라인). 프로덕션은 `s3`(S3/R2)로 스왑한다.
 *
 * put 은 드라이버별 `storageRef`(예: S3 object key)를 돌려줄 수 있다 — postgres 는 null.
 */
export interface PutResult {
  /** 드라이버별 참조(s3 object key 등). postgres 는 null(file_blobs.fileId 로 충분). */
  storageRef: string | null
}

export interface StorageAdapter {
  /** 드라이버 식별자 — file_objects.storage_driver 에 기록된다. */
  readonly driver: 'postgres' | 's3'
  /** 파일 바이트를 저장한다. fileId 는 레지스트리 행 id(이미 생성됨). */
  put(fileId: string, bytes: Buffer, contentType: string): Promise<PutResult>
  /** 파일 바이트를 조회한다. 없으면 null. */
  get(fileId: string, storageRef: string | null): Promise<Buffer | null>
  /** 파일 바이트를 삭제한다(멱등). */
  delete(fileId: string, storageRef: string | null): Promise<void>
}

/** S3 어댑터가 자격증명 미설정일 때 던지는 에러(컨트롤러가 503 으로 변환). */
export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageNotConfiguredError'
  }
}
