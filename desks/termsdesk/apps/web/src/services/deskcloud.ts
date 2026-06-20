/**
 * DeskCloud — 네이티브 통합 클라이언트 (브라우저, publishable 키 전용).
 * ──────────────────────────────────────────────────────────────────────────
 * @heejun/deskcloud 의 타입드 브라우저 클라이언트를 그대로 사용합니다(위젯 임베드 X).
 * 각 통합은 대응하는 VITE_<DESK>DESK_URL 이 설정된 경우에만 활성화되며,
 * 미설정 시 first-party 폴백(렌더 안 함)으로 앱에 영향이 없습니다.
 *
 * 보안: 오직 publishable 키(`pk_…`)만 브라우저에 노출됩니다. secret 키(`sk_…`)나
 * '@heejun/deskcloud/server' 는 클라이언트 번들에서 절대 import 하지 않습니다.
 * ──────────────────────────────────────────────────────────────────────────
 */
import {
  createChangelogClient,
  createNotifyClient,
  type ChangelogClient,
  type NotifyClient,
} from '@heejun/deskcloud'

const DEMO_PK = 'pk_demo'

/** ChangelogDesk endpoint(미설정이면 통합 비활성). */
export const changelogEndpoint: string | undefined = import.meta.env.VITE_CHANGELOGDESK_URL
/** NotifyDesk endpoint(미설정이면 통합 비활성). */
export const notifyEndpoint: string | undefined = import.meta.env.VITE_NOTIFYDESK_URL

/** 통합이 활성인지(= endpoint 가 설정됐는지) 여부. */
export const isChangelogEnabled = Boolean(changelogEndpoint)
export const isNotifyEnabled = Boolean(notifyEndpoint)

/**
 * ChangelogDesk 브라우저 클라이언트(활성일 때만). publishable 키 미지정 시 pk_demo.
 */
export function getChangelogClient(): ChangelogClient | null {
  if (!changelogEndpoint) return null
  return createChangelogClient({
    endpoint: changelogEndpoint,
    publishableKey: import.meta.env.VITE_CHANGELOGDESK_PK ?? DEMO_PK,
  })
}

/**
 * NotifyDesk 브라우저 클라이언트(활성일 때만). publishable 키 미지정 시 pk_demo.
 */
export function getNotifyClient(): NotifyClient | null {
  if (!notifyEndpoint) return null
  return createNotifyClient({
    endpoint: notifyEndpoint,
    publishableKey: import.meta.env.VITE_NOTIFYDESK_PK ?? DEMO_PK,
  })
}
