import { computeContentHash, type PublicRenderDto, type PublicVerifyDto } from '@termsdesk/shared'

import {
  buildPortfolioSitemapXml,
  findPortfolioPolicy,
  renderPortfolioPolicy,
} from './portfolio-legal'
import {
  EMBED_SCRIPT,
  renderPolicyDocument,
  type RenderAlign,
  type RenderFont,
  type RenderTheme,
  type RenderWidth,
} from './public-assets'

const RESERVED_QUERY_KEYS = new Set([
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

export interface PortfolioPublicRequest {
  method: string
  path: string[]
  query: URLSearchParams
}

export interface PortfolioPublicResponse {
  status: number
  headers: Record<string, string>
  body: string | PublicRenderDto | PublicVerifyDto | Record<string, unknown>
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
}

function baseHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=60',
    ...CORS_HEADERS,
    'Cross-Origin-Resource-Policy': 'cross-origin',
  }
}

function preflightResponse(): PortfolioPublicResponse {
  return {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'public, max-age=86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    body: '',
  }
}

function pickVars(query: URLSearchParams): Record<string, string | undefined> {
  const vars: Record<string, string | undefined> = {}
  for (const [key, value] of query.entries()) {
    if (!RESERVED_QUERY_KEYS.has(key)) vars[key] = value
  }
  return vars
}

function queryValue(query: URLSearchParams, key: string): string | undefined {
  const value = query.get(key)
  return value && value.trim() !== '' ? value : undefined
}

function isReadRequest(method: string): boolean {
  return method === 'GET' || method === 'HEAD'
}

function isPreflightRequest(method: string): boolean {
  return method === 'OPTIONS'
}

async function verifyPortfolioPolicy(
  projectSlug: string,
  policySlug: string,
  query: URLSearchParams
): Promise<PublicVerifyDto> {
  const match = findPortfolioPolicy(projectSlug, policySlug)
  if (!match) {
    throw new Error(`Unknown portfolio policy: ${projectSlug}/${policySlug}`)
  }

  const { project, policy } = match
  const stored = await computeContentHash(policy.body)
  const versionLabel = queryValue(query, 'version') ?? queryValue(query, 'versionLabel')
  const hash = queryValue(query, 'hash')
  const versionMatches = !versionLabel || versionLabel === policy.versionLabel
  const hashMatches = !hash || hash === stored
  const verified = versionMatches && hashMatches

  return {
    verified,
    orgName: project.name,
    policySlug: policy.slug,
    versionLabel: versionMatches ? policy.versionLabel : null,
    contentHash: stored,
    recomputedHash: stored,
    effectiveAt: policy.effectiveAt,
    publishedAt: policy.publishedAt,
    reason: verified
      ? undefined
      : versionLabel && !versionMatches
        ? '버전을 찾을 수 없습니다'
        : '이 해시에 해당하는 게시 버전이 없습니다',
  }
}

export async function resolvePortfolioPublicRequest({
  method,
  path,
  query,
}: PortfolioPublicRequest): Promise<PortfolioPublicResponse | null> {
  if (path.length === 1 && path[0] === 'sitemap.xml' && isPreflightRequest(method)) {
    return preflightResponse()
  }

  if (path.length === 1 && path[0] === 'sitemap.xml' && isReadRequest(method)) {
    return {
      status: 200,
      headers: {
        ...baseHeaders('application/xml; charset=utf-8'),
        'Cache-Control': 'public, max-age=3600',
      },
      body: buildPortfolioSitemapXml(),
    }
  }

  if (path.length === 1 && path[0] === 'embed.js' && isPreflightRequest(method)) {
    return preflightResponse()
  }

  if (path.length === 1 && path[0] === 'embed.js' && isReadRequest(method)) {
    return {
      status: 200,
      headers: {
        ...baseHeaders('application/javascript; charset=utf-8'),
        'Cache-Control': 'public, max-age=3600',
      },
      body: EMBED_SCRIPT,
    }
  }

  const [projectSlug, resource, policySlug, format] = path
  if (!projectSlug || resource !== 'policies' || !policySlug) return null
  if (!findPortfolioPolicy(projectSlug, policySlug)) return null

  if (isPreflightRequest(method)) {
    return preflightResponse()
  }

  if (!isReadRequest(method)) {
    return {
      status: 405,
      headers: baseHeaders('application/json; charset=utf-8'),
      body: { message: 'Method Not Allowed', error: 'Method Not Allowed', statusCode: 405 },
    }
  }

  if (!format) {
    const dto = await renderPortfolioPolicy(projectSlug, policySlug, { vars: pickVars(query) })
    return {
      status: 200,
      headers: baseHeaders('application/json; charset=utf-8'),
      body: dto,
    }
  }

  if (format === 'html') {
    const dto = await renderPortfolioPolicy(projectSlug, policySlug, { vars: pickVars(query) })
    return {
      status: 200,
      headers: baseHeaders('text/html; charset=utf-8'),
      body: renderPolicyDocument(dto, {
        theme: (queryValue(query, 'theme') as RenderTheme) ?? 'auto',
        accent: queryValue(query, 'accent'),
        font: queryValue(query, 'font') as RenderFont | undefined,
        align: queryValue(query, 'align') as RenderAlign | undefined,
        width: queryValue(query, 'width') as RenderWidth | undefined,
      }),
    }
  }

  if (format === 'text') {
    const dto = await renderPortfolioPolicy(projectSlug, policySlug, { vars: pickVars(query) })
    return {
      status: 200,
      headers: baseHeaders('text/plain; charset=utf-8'),
      body:
        `${dto.name} (${dto.versionLabel}) - ${dto.orgName}\n` +
        `${'='.repeat(40)}\n\n${dto.body}\n\n${'-'.repeat(40)}\n` +
        `content-hash: ${dto.contentHash}\n`,
    }
  }

  if (format === 'verify') {
    return {
      status: 200,
      headers: {
        ...baseHeaders('application/json; charset=utf-8'),
        'Cache-Control': 'public, max-age=30',
      },
      body: await verifyPortfolioPolicy(projectSlug, policySlug, query),
    }
  }

  return {
    status: 404,
    headers: baseHeaders('application/json; charset=utf-8'),
    body: { message: '약관을 찾을 수 없습니다', error: 'Not Found', statusCode: 404 },
  }
}
