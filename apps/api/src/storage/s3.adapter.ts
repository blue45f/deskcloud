import { Logger } from '@nestjs/common'

import type { StorageAdapter, StoredObject } from './storage.adapter'

export interface S3AdapterOptions {
  bucket: string | null
  region: string | null
  endpoint: string | null
  publicBaseUrl: string | null
}

/**
 * S3 어댑터 — 스텁(STUB). 인터페이스만 구현하고 실제 AWS 호출은 하지 않는다.
 *
 * 의도: StorageAdapter 가 진짜로 교체 가능함을 보여 주고(드라이버 선택지), 실제 배포 시
 * 이 클래스 본문을 @aws-sdk/client-s3 로 채우면 된다(키 스킴·공개 URL 규약은 동일).
 * 호출되면 명확히 실패(또는 no-op)하도록 두어, 자격증명 없이도 빌드·부팅이 깨지지 않는다.
 */
export class S3StorageAdapter implements StorageAdapter {
  readonly driver = 's3'
  private readonly logger = new Logger('S3Storage')

  constructor(private readonly opts: S3AdapterOptions) {
    this.logger.warn(
      'S3 스토리지 드라이버는 스텁입니다 — 실제 업로드/조회는 동작하지 않습니다. 로컬 드라이버를 사용하세요.'
    )
  }

  describe(): string {
    const where = this.opts.bucket
      ? `s3://${this.opts.bucket}${this.opts.region ? ` (${this.opts.region})` : ''}`
      : '(버킷 미설정)'
    return `S3 (스텁) · ${where}`
  }

  private notImplemented(): never {
    throw new Error(
      'S3 스토리지 어댑터는 스텁입니다. 실제 객체 저장소가 필요하면 local 드라이버를 쓰거나 ' +
        '이 어댑터를 @aws-sdk/client-s3 로 구현하세요.'
    )
  }

  put(_key: string, _body: Buffer, _contentType: string): Promise<void> {
    this.notImplemented()
  }

  get(_key: string): Promise<StoredObject | null> {
    this.notImplemented()
  }

  async exists(_key: string): Promise<boolean> {
    return false
  }

  async delete(_key: string): Promise<void> {
    // 스텁 — no-op (멱등 삭제 계약 유지).
  }

  async deletePrefix(_prefix: string): Promise<void> {
    // 스텁 — no-op.
  }
}
