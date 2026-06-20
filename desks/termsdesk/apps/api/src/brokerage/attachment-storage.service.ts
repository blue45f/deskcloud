import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config'

export interface StoredAttachment {
  buffer: Buffer
  contentType: string
  contentLength: number | null
}

@Injectable()
export class AttachmentStorageService {
  private readonly client: S3Client | null

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {
    const storage = this.storageConfig()
    this.client = storage.bucket
      ? new S3Client({
          region: storage.region,
          endpoint: storage.endpoint ?? undefined,
          forcePathStyle: storage.forcePathStyle,
        })
      : null
  }

  isConfigured(): boolean {
    return Boolean(this.storageConfig().bucket && this.client)
  }

  maxBytes(): number {
    return this.storageConfig().maxBytes
  }

  private bucket(): string {
    const bucket = this.storageConfig().bucket
    if (!bucket || !this.client) {
      throw new ServiceUnavailableException('첨부 파일 저장소가 설정되지 않았습니다')
    }
    return bucket
  }

  private storageConfig(): NonNullable<AppConfig['attachmentStorage']> {
    return (
      this.cfg.attachmentStorage ?? {
        bucket: null,
        region: 'ap-northeast-2',
        endpoint: null,
        forcePathStyle: false,
        maxBytes: 10 * 1024 * 1024,
      }
    )
  }

  async put(input: { key: string; body: Buffer; contentType: string }): Promise<void> {
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ServerSideEncryption: 'AES256',
      })
    )
  }

  async get(key: string): Promise<StoredAttachment> {
    const out = await this.client!.send(
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: key,
      })
    )
    const body = out.Body
    if (!body) {
      return {
        buffer: Buffer.alloc(0),
        contentType: out.ContentType ?? 'application/octet-stream',
        contentLength: out.ContentLength ?? null,
      }
    }

    const transformer = body as { transformToByteArray?: () => Promise<Uint8Array> }
    const bytes =
      typeof transformer.transformToByteArray === 'function'
        ? await transformer.transformToByteArray()
        : await streamToBytes(body as AsyncIterable<Uint8Array>)

    return {
      buffer: Buffer.from(bytes),
      contentType: out.ContentType ?? 'application/octet-stream',
      contentLength: out.ContentLength ?? bytes.length,
    }
  }
}

async function streamToBytes(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let length = 0
  for await (const chunk of stream) {
    chunks.push(chunk)
    length += chunk.byteLength
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
