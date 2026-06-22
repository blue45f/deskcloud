import {
  resolvePortfolioPublicRequest,
  type PortfolioPublicResponse,
} from '../apps/api/src/public/portfolio-public-handler.js'

import type { IncomingHttpHeaders } from 'node:http'

const FALLBACK_API_ORIGIN = (
  process.env.TERMSDESK_API_ORIGIN ?? 'https://3.107.235.143.nip.io'
).replace(/\/$/, '')

interface VercelRequestLike {
  method?: string
  url?: string
  query?: {
    path?: string | string[]
  }
  headers: IncomingHttpHeaders
  body?: unknown
}

interface VercelResponseLike {
  status: (statusCode: number) => VercelResponseLike
  setHeader: (name: string, value: string | string[]) => void
  send: (body: unknown) => void
  json: (body: unknown) => void
}

const PUBLIC_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
  'Cross-Origin-Resource-Policy': 'cross-origin',
}

function apiPathFromRequest(req: VercelRequestLike): string[] {
  const param = req.query?.path
  if (Array.isArray(param)) return param.flatMap((part) => part.split('/')).filter(Boolean)
  if (typeof param === 'string') return param.split('/').filter(Boolean)

  const pathname = new URL(req.url ?? '/', 'https://3.107.235.143.nip.io').pathname
  return pathname
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean)
}

function queryFromRequest(req: VercelRequestLike): URLSearchParams {
  const params = new URL(req.url ?? '/', 'https://3.107.235.143.nip.io').searchParams
  params.delete('path')
  return params
}

function sendPortfolioResponse(res: VercelResponseLike, result: PortfolioPublicResponse): void {
  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value)
  }

  res.status(result.status)
  const contentType = result.headers['Content-Type'] ?? ''
  if (contentType.includes('application/json')) res.json(result.body)
  else res.send(result.body)
}

function applyPublicCorsHeaders(res: VercelResponseLike): void {
  for (const [key, value] of Object.entries(PUBLIC_CORS_HEADERS)) {
    res.setHeader(key, value)
  }
}

function sendPublicPreflight(res: VercelResponseLike): void {
  applyPublicCorsHeaders(res)
  res.status(204).send('')
}

function shouldUsePortfolioPublicHandler(apiPath: string[]): boolean {
  if (apiPath[0] !== 'public') return false
  const publicPath = apiPath.slice(1)
  // The sitemap must come from the upstream API so DB-backed expert directory URLs are included.
  if (publicPath.length === 1 && publicPath[0] === 'sitemap.xml') return false
  return true
}

function forwardedHeaders(headers: IncomingHttpHeaders): Headers {
  const next = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    if (!value || key.toLowerCase() === 'host') continue
    if (Array.isArray(value)) next.set(key, value.join(', '))
    else next.set(key, value)
  }
  return next
}

function proxyBody(req: VercelRequestLike) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined
  if (req.body === undefined || req.body === null) return undefined
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString()
  if (req.body instanceof ArrayBuffer) return req.body
  return JSON.stringify(req.body)
}

async function proxyFallback(
  req: VercelRequestLike,
  res: VercelResponseLike,
  apiPath: string[],
  query: URLSearchParams
): Promise<void> {
  if (apiPath.length === 0) {
    res.status(404).json({ message: 'API path is required', error: 'Not Found', statusCode: 404 })
    return
  }

  const qs = query.toString()
  const upstreamUrl = `${FALLBACK_API_ORIGIN}/api/${apiPath.map(encodeURIComponent).join('/')}${
    qs ? `?${qs}` : ''
  }`
  const upstream = await fetch(upstreamUrl, {
    method: req.method ?? 'GET',
    headers: forwardedHeaders(req.headers),
    body: proxyBody(req),
  })

  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'content-encoding') res.setHeader(key, value)
  })
  if (apiPath[0] === 'public') applyPublicCorsHeaders(res)

  res.status(upstream.status)
  res.send(Buffer.from(await upstream.arrayBuffer()))
}

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike
): Promise<void> {
  const apiPath = apiPathFromRequest(req)
  const query = queryFromRequest(req)

  if (apiPath[0] === 'public' && (req.method ?? 'GET') === 'OPTIONS') {
    sendPublicPreflight(res)
    return
  }

  if (shouldUsePortfolioPublicHandler(apiPath)) {
    const portfolio = await resolvePortfolioPublicRequest({
      method: req.method ?? 'GET',
      path: apiPath.slice(1),
      query,
    })

    if (portfolio) {
      sendPortfolioResponse(res, portfolio)
      return
    }
  }

  await proxyFallback(req, res, apiPath, query)
}
