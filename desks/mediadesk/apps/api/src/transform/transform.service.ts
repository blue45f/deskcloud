import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { TRANSFORM_FORMATS, isTransformableMime, type TransformFormat } from '@mediadesk/shared'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config'

export interface TransformParams {
  w?: number
  h?: number
  format?: TransformFormat
  q?: number
}

export interface TransformOutput {
  body: Buffer
  contentType: string
}

export interface ImageDimensions {
  width: number | null
  height: number | null
}

const FORMAT_MIME: Record<TransformFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
}

/**
 * 이미지 변환(best-effort) — 'sharp' 가 설치/로드되면 온더플라이 리사이즈·포맷·품질 변환과
 * 디스크 파생 캐시를 제공한다. sharp 가 없으면 transformAvailable=false 로 떨어지고, 호출부는
 * 원본을 그대로 서빙한다(빌드/런타임 어디서도 sharp 부재로 깨지지 않도록 import 를 가드).
 */
@Injectable()
export class TransformService implements OnModuleInit {
  private readonly logger = new Logger('Transform')
  // 동적으로 로드한 sharp 모듈(없으면 null). 타입은 느슨하게 — 선택 의존이라 @types 보장 안 됨.
  private sharp: ((input: Buffer) => SharpLike) | null = null

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  async onModuleInit(): Promise<void> {
    try {
      // 가드된 동적 import — sharp 미설치/네이티브 로드 실패 시 catch 로 떨어진다.
      const mod = (await import('sharp').catch(() => null)) as { default?: unknown } | null
      const fn = (mod?.default ?? mod) as ((input: Buffer) => SharpLike) | undefined
      if (typeof fn === 'function') {
        this.sharp = fn
        this.logger.log('sharp 로드 완료 — 온더플라이 이미지 변환 사용 가능')
      } else {
        this.logger.warn('sharp 를 찾을 수 없습니다 — 변환 비활성(원본 서빙).')
      }
    } catch {
      this.logger.warn('sharp 로드 실패 — 변환 비활성(원본 서빙).')
      this.sharp = null
    }
  }

  /** sharp 사용 가능 여부(어드민 정보·자산 transformable 판정에 사용). */
  get available(): boolean {
    return this.sharp !== null
  }

  /** 변환이 요청되었는지(파라미터가 하나라도 있는지). */
  static hasParams(p: TransformParams): boolean {
    return p.w !== undefined || p.h !== undefined || p.format !== undefined || p.q !== undefined
  }

  /** 자산이 변환 가능 대상인지(래스터 이미지 + sharp 로드됨). */
  isTransformable(contentType: string): boolean {
    return this.available && isTransformableMime(contentType)
  }

  /** 원본 이미지 치수 추출(가능하면). sharp 없으면 {null,null}. */
  async probeDimensions(body: Buffer, contentType: string): Promise<ImageDimensions> {
    if (!this.sharp || !isTransformableMime(contentType)) return { width: null, height: null }
    try {
      const meta = await this.sharp(body).metadata()
      return { width: meta.width ?? null, height: meta.height ?? null }
    } catch {
      return { width: null, height: null }
    }
  }

  /**
   * 변환 적용(+디스크 파생 캐시). 변환 불가(sharp 없음/비이미지/파라미터 없음)면 null 을 반환해
   * 호출부가 원본을 서빙하도록 한다.
   */
  async transform(
    cacheKey: string,
    body: Buffer,
    contentType: string,
    params: TransformParams
  ): Promise<TransformOutput | null> {
    if (!this.sharp) return null
    if (!isTransformableMime(contentType)) return null
    if (!TransformService.hasParams(params)) return null

    const outFormat = params.format ?? null
    const outContentType = outFormat ? FORMAT_MIME[outFormat] : contentType

    const cachePath = this.cachePathFor(cacheKey, params, outFormat ?? extFromMime(contentType))
    const cached = await readFile(cachePath).catch(() => null)
    if (cached) return { body: cached, contentType: outContentType }

    try {
      let pipeline = this.sharp(body)
      if (params.w !== undefined || params.h !== undefined) {
        pipeline = pipeline.resize({
          width: params.w,
          height: params.h,
          fit: 'inside',
          withoutEnlargement: true,
        })
      }
      const quality = params.q
      if (outFormat) {
        pipeline = applyFormat(pipeline, outFormat, quality)
      } else if (quality !== undefined) {
        // 포맷 미지정이지만 품질 지정 — 원본 포맷으로 재인코딩(품질 적용).
        const native = nativeFormat(contentType)
        if (native) pipeline = applyFormat(pipeline, native, quality)
      }
      const out = await pipeline.toBuffer()
      // 캐시에 비동기 기록(실패해도 응답엔 영향 없음).
      void mkdir(dirname(cachePath), { recursive: true })
        .then(() => writeFile(cachePath, out))
        .catch(() => undefined)
      return { body: out, contentType: outContentType }
    } catch (err) {
      this.logger.warn(`변환 실패 — 원본 서빙으로 폴백: ${(err as Error).message}`)
      return null
    }
  }

  private cachePathFor(cacheKey: string, params: TransformParams, ext: string): string {
    const sig = `${params.w ?? ''}x${params.h ?? ''}.${params.format ?? ''}.q${params.q ?? ''}`
    const hash = createHash('sha256').update(`${cacheKey}|${sig}`).digest('hex').slice(0, 32)
    const root = resolve(this.cfg.derivativeCacheDir)
    return join(root, `${hash}.${ext}`)
  }
}

// ── sharp 느슨한 타입(선택 의존이라 @types/sharp 를 강제하지 않음) ───────────────
interface SharpLike {
  metadata(): Promise<{ width?: number; height?: number }>
  resize(opts: {
    width?: number
    height?: number
    fit?: string
    withoutEnlargement?: boolean
  }): SharpLike
  jpeg(opts?: { quality?: number }): SharpLike
  png(opts?: { quality?: number }): SharpLike
  webp(opts?: { quality?: number }): SharpLike
  avif(opts?: { quality?: number }): SharpLike
  toBuffer(): Promise<Buffer>
}

function applyFormat(pipeline: SharpLike, format: TransformFormat, quality?: number): SharpLike {
  const opts = quality !== undefined ? { quality } : undefined
  switch (format) {
    case 'jpeg':
      return pipeline.jpeg(opts)
    case 'png':
      return pipeline.png(opts)
    case 'webp':
      return pipeline.webp(opts)
    case 'avif':
      return pipeline.avif(opts)
    default:
      return pipeline
  }
}

function nativeFormat(contentType: string): TransformFormat | null {
  const map: Record<string, TransformFormat> = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  }
  const f = map[contentType]
  return f && (TRANSFORM_FORMATS as readonly string[]).includes(f) ? f : null
}

function extFromMime(contentType: string): string {
  return nativeFormat(contentType) ?? 'bin'
}
