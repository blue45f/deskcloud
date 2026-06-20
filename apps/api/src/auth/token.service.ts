import { createHmac } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { jwtVerify, SignJWT } from 'jose'

import { APP_CONFIG, type AppConfig } from '../config'

/** end-user 액세스 토큰의 검증된 클레임. */
export interface EndUserClaims {
  /** 세션 id(jti) — sessions 테이블의 PK. 로그아웃/폐기 검사에 사용. */
  jti: string
  /** end-user id. */
  sub: string
  /** 테넌트 id — 토큰이 어느 테넌트 풀에 속하는지. */
  tid: string
}

const ISSUER = 'authdesk'
const AUDIENCE = 'authdesk-end-user'

/**
 * end-user 세션 JWT 서명/검증 — HS256.
 *
 * 테넌트별 서명 비밀을 HMAC-SHA256(jwtSecret, tenantId) 로 파생한다. 그래서 각 테넌트의
 * 사용자 풀이 격리된 서명 도메인을 가지며, 한 테넌트의 토큰을 다른 테넌트에서 검증할 수 없다
 * (한 테넌트 비밀 노출이 다른 테넌트로 번지지 않음). 베이스 비밀은 AUTHDESK_JWT_SECRET.
 *
 * 토큰 평문/비밀은 절대 로그에 남기지 않는다.
 */
@Injectable()
export class TokenService {
  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  /** 액세스 토큰 수명(초) — 세션 행 만료를 토큰 만료와 맞추는 데 쓴다. */
  get ttlSeconds(): number {
    return this.cfg.accessTtlSeconds
  }

  /** 테넌트별 서명 키(32바이트). */
  private tenantKey(tenantId: string): Uint8Array {
    return new Uint8Array(createHmac('sha256', this.cfg.jwtSecret).update(tenantId).digest())
  }

  /** end-user 액세스 토큰 발급. expiresIn(초)은 cfg.accessTtlSeconds. */
  async sign(claims: EndUserClaims): Promise<{ token: string; expiresIn: number }> {
    const ttl = this.cfg.accessTtlSeconds
    const token = await new SignJWT({ tid: claims.tid })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.sub)
      .setJti(claims.jti)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ttl}s`)
      .sign(this.tenantKey(claims.tid))
    return { token, expiresIn: ttl }
  }

  /**
   * 토큰 검증 — 서명·만료·issuer·audience 를 확인하고 클레임을 반환한다.
   * 테넌트 id 는 토큰 본문(tid)에서 읽어 그 테넌트 키로 검증한다(키 분리 유지).
   * 유효하지 않으면 null.
   */
  async verify(token: string): Promise<EndUserClaims | null> {
    // 서명 검증 전에 tid 를 알아야 키를 고른다 → 페이로드를 1차 디코드(미검증)한 뒤,
    // 그 tid 의 키로 정식 검증한다. 미검증 디코드 값은 키 선택에만 쓰고 신뢰하지 않는다.
    const tid = decodeTidUnsafe(token)
    if (!tid) return null
    try {
      const { payload } = await jwtVerify(token, this.tenantKey(tid), {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      })
      if (!payload.jti || !payload.sub || payload.tid !== tid) return null
      return { jti: payload.jti, sub: payload.sub, tid }
    } catch {
      return null
    }
  }
}

/** 검증 전 페이로드에서 tid 만 읽는다(키 선택용, 신뢰하지 않음). 실패 시 null. */
function decodeTidUnsafe(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(parts[1]!, 'base64url').toString('utf8')
    const obj = JSON.parse(json) as { tid?: unknown }
    return typeof obj.tid === 'string' && obj.tid.length > 0 ? obj.tid : null
  } catch {
    return null
  }
}
