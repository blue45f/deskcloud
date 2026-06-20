import type { AppConfig } from '../config'
import type { Request } from 'express'

/**
 * 공개 자산 URL 의 베이스를 결정한다.
 * PUBLIC_BASE_URL 이 설정돼 있으면 그것을, 없으면 요청의 프로토콜·호스트에서 추론한다
 * (프록시 뒤를 고려해 x-forwarded-* 우선).
 */
export function resolveBaseUrl(cfg: AppConfig, req: Request): string {
  if (cfg.publicBaseUrl) return cfg.publicBaseUrl.replace(/\/+$/g, '')
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ||
    req.protocol ||
    'http'
  const host =
    (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ||
    req.headers.host ||
    `localhost:${cfg.port}`
  return `${proto}://${host}`
}
