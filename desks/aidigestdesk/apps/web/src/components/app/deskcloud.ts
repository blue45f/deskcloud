// DeskCloud 플랫폼 연동 게이트.
//
// 형제 SaaS 패밀리(@heejun/deskcloud)의 브라우저(pk_) 클라이언트를 env로 게이트한다.
// `VITE_*DESK_URL` + `VITE_*DESK_PK` 가 설정되면 해당 기능(회원/커뮤니티/약관)을
// 실제 DeskCloud 서비스로 위임하고, 미설정이면 각 기능의 로컬 데모로 폴백한다.
// (DeskCloud 백엔드가 도커 호스트에 배포되고 테넌트 pk_ 키를 발급받으면 활성화됨 —
//  deskcloud-deploy/docs/STATUS.md 참고. 정적 SPA라 pk_ 키만 사용한다.)

import {
  createAuthClient,
  createCommunityClient,
  createTermsClient,
} from '@heejun/deskcloud'

type DeskConfig = { endpoint: string; publishableKey: string }

const env = import.meta.env

function readConfig(url?: string, pk?: string): DeskConfig | null {
  const endpoint = url?.trim()
  if (!endpoint) return null
  return { endpoint, publishableKey: pk?.trim() ?? '' }
}

const authConfig = readConfig(env.VITE_AUTHDESK_URL, env.VITE_AUTHDESK_PK)
const communityConfig = readConfig(env.VITE_COMMUNITYDESK_URL, env.VITE_COMMUNITYDESK_PK)
const termsConfig = readConfig(env.VITE_TERMSDESK_URL, env.VITE_TERMSDESK_PK)

/** 각 DeskCloud 기능 활성화 여부(env 설정 시 true). */
export const deskcloudEnabled = {
  auth: authConfig !== null,
  community: communityConfig !== null,
  terms: termsConfig !== null,
} as const

/** TermsDesk 공개 렌더 라우트(:orgSlug)용 조직 slug. */
export const termsOrgSlug = env.VITE_TERMSDESK_ORG?.trim() ?? ''

/** AuthDesk 브라우저 클라이언트(미설정 시 null → 로컬 데모 인증 폴백). */
export function getAuthClient() {
  return authConfig ? createAuthClient(authConfig) : null
}

/** CommunityDesk 브라우저 클라이언트(미설정 시 null → 로컬 데모 폴백). */
export function getCommunityClient() {
  return communityConfig ? createCommunityClient(communityConfig) : null
}

/** TermsDesk 브라우저 클라이언트(미설정 시 null → 내부 정적 약관 폴백). */
export function getTermsClient() {
  return termsConfig ? createTermsClient(termsConfig) : null
}
