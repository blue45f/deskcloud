// 공유 공통 모듈 배럴 — desk-platform/apps/web/src/lib/share/ 에서 순수 유틸만 벤더링.
// ShareButton(앱별 토큰/토스트 의존)은 가져오지 않고, 각 페이지가 자체 버튼 + pushToast 로 래핑한다.
export { shareOrCopy } from './shareOrCopy'
export type { ShareInput, ShareResult } from './shareOrCopy'
