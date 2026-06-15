// @desk/core — 프레임워크 무관 멀티테넌트 코어.
// NestJS 어댑터(가드/프로바이더)는 '@desk/core/nest' 에서 가져온다.
export * from './ports'
export * from './cors'
export * from './usage-meter'
export * from './tenant-service'
export * from './memory-stores'

// shared 의 키/플랜 유틸을 코어 사용자가 한 곳에서 쓰도록 재노출.
export {
  generatePublishableKey,
  generateSecretKey,
  hashSecretKey,
  verifySecretKey,
  extractBearerKey,
  isPublishableKey,
  isSecretKey,
  PLAN_LIMITS,
  checkLimit,
  limitFor,
} from '@desk/shared'
