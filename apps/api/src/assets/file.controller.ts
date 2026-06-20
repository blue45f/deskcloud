import { transformQuerySchema } from '@mediadesk/shared'
import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { AssetsService } from './assets.service'

import type { Request, Response } from 'express'

/**
 * 공개 파일 서빙 — /file/:slug/<key...> (전역 /api 프리픽스에서 제외, 스로틀 제외).
 * 변환 쿼리(?w=&h=&format=&q=)가 있고 sharp 로 처리 가능하면 변환본을, 아니면 원본을 서빙한다.
 *
 * key 는 폴더 구분(/)을 포함할 수 있어 Express 5 와일드카드(*key)로 받는다.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('file')
export class FileController {
  constructor(private readonly assets: AssetsService) {}

  @Get(':slug/*key')
  async serve(
    @Param('slug') slug: string,
    @Param('key') keyParam: string | string[],
    @Query(new ZodValidationPipe(transformQuerySchema))
    query: { w?: number; h?: number; format?: 'jpeg' | 'png' | 'webp' | 'avif'; q?: number },
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    // Express 5 와일드카드는 세그먼트 배열로 줄 수 있다 — 다시 합친다.
    const key = Array.isArray(keyParam) ? keyParam.join('/') : keyParam
    const result = await this.assets.serve(slug, decodeURIComponent(key), query)

    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Content-Length', String(result.body.byteLength))
    res.setHeader(
      'Cache-Control',
      result.immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
    )
    // 키는 콘텐츠 주소(무작위 세그먼트 포함)라 ETag 는 키 자체로 충분.
    res.setHeader('ETag', `"${key}"`)
    if (req.headers['if-none-match'] === `"${key}"`) {
      res.status(304).end()
      return
    }
    res.status(200).end(result.body)
  }
}
