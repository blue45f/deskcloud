// 공유 유틸 — desk-platform/apps/web/src/lib/share 에서 벤더링한 순수 함수.
// Web Share API 우선, 미지원/취소 시 클립보드 복사 폴백. 디자인 의존성 없음.
export { shareOrCopy, type ShareInput, type ShareResult } from './shareOrCopy'
