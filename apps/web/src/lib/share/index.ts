// 공유 공통 모듈 배럴 — desk-platform/apps/web/src/lib/share 의 portable 계약을 벤더링.
// shareOrCopy 는 디자인 의존성 없는 순수 함수, ShareButton 은 NotifyDesk 토큰에 맞춘 래퍼.
export { shareOrCopy } from './shareOrCopy'
export type { ShareInput, ShareResult } from './shareOrCopy'
export { ShareButton } from './ShareButton'
