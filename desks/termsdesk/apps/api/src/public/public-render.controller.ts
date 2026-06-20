import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { buildPortfolioSitemapXml } from './portfolio-legal'
import {
  EMBED_SCRIPT,
  type RenderAlign,
  type RenderFont,
  renderPolicyDocument,
  type RenderTheme,
  type RenderWidth,
} from './public-assets'
import { PublicProvidersService } from './public-providers.service'
import { PublicRenderService } from './public-render.service'

import type { PublicRenderDto, PublicVerifyDto } from '@termsdesk/shared'
import type { Response } from 'express'

/** 쿼리에서 예약어를 뺀 나머지를 템플릿 변수로 사용. */
const RESERVED = new Set([
  'version',
  'versionLabel',
  'locale',
  'theme',
  'format',
  'accent',
  'font',
  'align',
  'width',
])

function pickVars(query: Record<string, unknown>): Record<string, string | undefined> {
  const vars: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(query)) {
    if (RESERVED.has(k)) continue
    if (typeof v === 'string') vars[k] = v
  }
  return vars
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

/** 임베드/iframe 가 교차 출처에서 로드되도록 helmet 의 동일출처 잠금을 해제. */
function allowEmbedding(res: Response): void {
  res.removeHeader('X-Frame-Options')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
}

/**
 * 공개(인증 없음) 약관 렌더링 — 푸터 링크·팝업·iframe·임베드 위젯이 소비.
 * `/api/public/:orgSlug/policies/:slug`(JSON|HTML|TEXT) + `/api/public/embed.js` + `/api/public/sitemap.xml`.
 * self-hosted 단일 조직은 orgSlug 를 `_` 로 줄 수 있습니다.
 */
@ApiTags('public-render')
@Controller('public')
export class PublicRenderController {
  constructor(
    private readonly render: PublicRenderService,
    private readonly providers: PublicProvidersService
  ) {}

  @Get('embed.js')
  @ApiOperation({ summary: '드롭인 임베드 위젯 스크립트 (모달 팝업)' })
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  embed(@Res({ passthrough: true }) res: Response): string {
    allowEmbedding(res)
    return EMBED_SCRIPT
  }

  @Get('sitemap.xml')
  @ApiOperation({ summary: '검색엔진 sitemap — 랜딩·공개 약관·지원 보드 URL 색인' })
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async sitemap(): Promise<string> {
    return buildPortfolioSitemapXml(await this.providers.sitemapEntries())
  }

  @Get(':orgSlug/policies/:slug')
  @ApiOperation({ summary: '공개 약관 렌더 (JSON) — version·로케일·{{변수}} 치환 지원' })
  async json(
    @Param('orgSlug') orgSlug: string,
    @Param('slug') slug: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response
  ): Promise<PublicRenderDto> {
    const dto = await this.render.render(orgSlug, slug, {
      versionLabel: str(query.version) ?? str(query.versionLabel),
      locale: str(query.locale),
      vars: pickVars(query),
    })
    allowEmbedding(res)
    res.setHeader('Cache-Control', 'public, max-age=60')
    return dto
  }

  @Get(':orgSlug/policies/:slug/html')
  @ApiOperation({ summary: '공개 약관 렌더 (독립형 HTML 문서) — iframe·팝업·직접 링크용' })
  async html(
    @Param('orgSlug') orgSlug: string,
    @Param('slug') slug: string,
    @Query() query: Record<string, unknown>,
    @Res() res: Response
  ): Promise<void> {
    const dto = await this.render.render(orgSlug, slug, {
      versionLabel: str(query.version) ?? str(query.versionLabel),
      locale: str(query.locale),
      vars: pickVars(query),
    })
    allowEmbedding(res)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.send(
      renderPolicyDocument(dto, {
        theme: (str(query.theme) as RenderTheme) ?? 'auto',
        accent: str(query.accent),
        font: str(query.font) as RenderFont | undefined,
        align: str(query.align) as RenderAlign | undefined,
        width: str(query.width) as RenderWidth | undefined,
      })
    )
  }

  @Get(':orgSlug/policies/:slug/verify')
  @ApiOperation({ summary: '변조 검증 — 저장 본문 재해싱으로 content_hash 진위 확인' })
  async verify(
    @Param('orgSlug') orgSlug: string,
    @Param('slug') slug: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response
  ): Promise<PublicVerifyDto> {
    const dto = await this.render.verify(orgSlug, slug, {
      hash: str(query.hash),
      versionLabel: str(query.version) ?? str(query.versionLabel),
    })
    allowEmbedding(res)
    res.setHeader('Cache-Control', 'public, max-age=30')
    return dto
  }

  @Get(':orgSlug/policies/:slug/text')
  @ApiOperation({ summary: '공개 약관 렌더 (text/plain)' })
  async text(
    @Param('orgSlug') orgSlug: string,
    @Param('slug') slug: string,
    @Query() query: Record<string, unknown>,
    @Res() res: Response
  ): Promise<void> {
    const dto = await this.render.render(orgSlug, slug, {
      versionLabel: str(query.version) ?? str(query.versionLabel),
      locale: str(query.locale),
      vars: pickVars(query),
    })
    allowEmbedding(res)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.send(
      `${dto.name} (${dto.versionLabel}) — ${dto.orgName}\n` +
        `${'='.repeat(40)}\n\n${dto.body}\n\n${'-'.repeat(40)}\n` +
        `content-hash: ${dto.contentHash}\n`
    )
  }
}
