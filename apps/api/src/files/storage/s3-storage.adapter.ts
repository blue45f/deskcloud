import { StorageNotConfiguredError } from './storage.adapter'

import type { PutResult, StorageAdapter } from './storage.adapter'
import type { S3Config } from '../../config'


/**
 * S3/R2 어댑터 — 프로덕션 스왑(문서화된 스텁).
 *
 * 실제 S3/R2 SDK 호출을 여기에 연결한다(예: @aws-sdk/client-s3 PutObjectCommand 등).
 * 이 레포는 실제 자격증명/네트워크 호출을 포함하지 않는다(과제 안전 정책) — 자격증명이
 * 설정되어 있으면 "연결 지점"을 명확히 표기하고 NOT_IMPLEMENTED 로, 미설정이면
 * StorageNotConfiguredError 로 친절히 안내한다.
 *
 * 구현 시 교체 지점:
 *   put:    client.send(new PutObjectCommand({ Bucket, Key: objectKey, Body: bytes, ContentType }))
 *   get:    client.send(new GetObjectCommand({ Bucket, Key })) → Body 스트림 → Buffer
 *   delete: client.send(new DeleteObjectCommand({ Bucket, Key }))
 * publicBaseUrl 이 있으면 public 파일은 CDN URL 로 직접 서빙(API 프록시 우회) 가능.
 */
export class S3StorageAdapter implements StorageAdapter {
  readonly driver = 's3' as const

  constructor(private readonly cfg: S3Config) {}

  /** 필수 자격증명이 모두 채워졌는지. */
  isConfigured(): boolean {
    return Boolean(this.cfg.bucket && this.cfg.region && this.cfg.accessKeyId && this.cfg.secretAccessKey)
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new StorageNotConfiguredError(
        'S3 스토리지가 구성되지 않았습니다. S3_BUCKET·S3_REGION·S3_ACCESS_KEY_ID·S3_SECRET_ACCESS_KEY 를 설정하세요.'
      )
    }
  }

  /** s3 object key 규약 — 테넌트/파일 충돌 없이 평면 키. */
  objectKeyFor(fileId: string): string {
    return `files/${fileId}`
  }

  put(_fileId: string, _bytes: Buffer, _contentType: string): Promise<PutResult> {
    this.ensureConfigured()
    // 실제 업로드 연결 지점(위 주석 참고). 스텁: 구현 전까지 명시적 미구현.
    throw new StorageNotConfiguredError(
      'S3 어댑터 put 은 이 빌드에 연결되지 않았습니다(스텁). @aws-sdk/client-s3 PutObjectCommand 를 연결하세요.'
    )
  }

  get(_fileId: string, _storageRef: string | null): Promise<Buffer | null> {
    this.ensureConfigured()
    throw new StorageNotConfiguredError(
      'S3 어댑터 get 은 이 빌드에 연결되지 않았습니다(스텁). GetObjectCommand 를 연결하세요.'
    )
  }

  delete(_fileId: string, _storageRef: string | null): Promise<void> {
    this.ensureConfigured()
    throw new StorageNotConfiguredError(
      'S3 어댑터 delete 는 이 빌드에 연결되지 않았습니다(스텁). DeleteObjectCommand 를 연결하세요.'
    )
  }
}
